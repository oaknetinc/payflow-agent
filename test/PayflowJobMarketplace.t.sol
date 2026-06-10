// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PayflowAgentFactory} from "../contracts/PayflowAgentFactory.sol";
import {PayflowJobMarketplace} from "../contracts/PayflowJobMarketplace.sol";

interface Vm {
    function warp(uint256 timestamp) external;
}

contract JobToken {
    mapping(address account => uint256 balance) public balanceOf;
    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;

    function mint(address account, uint256 amount) external {
        balanceOf[account] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allowance");
        require(balanceOf[from] >= amount, "balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract AlwaysVerifier {
    bool public result = true;

    function setResult(bool result_) external {
        result = result_;
    }

    function verify(uint256, address, address, bytes32, bytes32, bytes calldata) external view returns (bool) {
        return result;
    }
}

contract JobUser {
    function createAgent(PayflowAgentFactory factory, string calldata name) external {
        factory.createAgent(name, 3 days);
    }

    function approve(JobToken token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }

    function post(
        PayflowJobMarketplace marketplace,
        address token,
        address verifier,
        address resolver,
        PayflowJobMarketplace.VerificationMode mode
    ) external returns (uint256) {
        PayflowJobMarketplace.JobRequest memory request = PayflowJobMarketplace.JobRequest({
            token: token,
            reward: 100e6,
            acceptanceDeadline: uint64(block.timestamp + 1 days),
            workDeadline: uint64(block.timestamp + 3 days),
            reviewPeriod: uint64(1 days),
            verificationMode: mode,
            verifier: verifier,
            resolver: resolver,
            specificationHash: keccak256("specification"),
            metadataURI: "ipfs://job"
        });
        return marketplace.postJob(address(this), request);
    }

    function fund(PayflowJobMarketplace marketplace, uint256 jobId) external {
        marketplace.fundJob(jobId);
    }

    function accept(PayflowJobMarketplace marketplace, uint256 jobId) external {
        marketplace.acceptJob(jobId, address(this));
    }

    function submit(PayflowJobMarketplace marketplace, uint256 jobId) external {
        marketplace.submitWork(jobId, address(this), keccak256("delivery"), "ipfs://delivery", "proof");
    }

    function approveWork(PayflowJobMarketplace marketplace, uint256 jobId) external {
        marketplace.approveWork(jobId);
    }

    function reject(PayflowJobMarketplace marketplace, uint256 jobId) external {
        marketplace.rejectSubmission(jobId, keccak256("changes requested"));
    }

    function dispute(PayflowJobMarketplace marketplace, uint256 jobId) external {
        marketplace.raiseDispute(jobId, keccak256("disputed"));
    }

    function resolve(PayflowJobMarketplace marketplace, uint256 jobId, bool payWorker) external {
        marketplace.resolveDispute(jobId, payWorker);
    }

    function refund(PayflowJobMarketplace marketplace, uint256 jobId) external {
        marketplace.claimDeadlineRefund(jobId);
    }

    function claimReview(PayflowJobMarketplace marketplace, uint256 jobId) external {
        marketplace.claimReviewTimeout(jobId);
    }
}

contract PayflowJobMarketplaceTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    PayflowAgentFactory private factory;
    PayflowJobMarketplace private marketplace;
    JobToken private token;
    AlwaysVerifier private verifier;
    JobUser private requester;
    JobUser private worker;
    JobUser private resolver;

    function setUp() public {
        factory = new PayflowAgentFactory(address(this));
        token = new JobToken();
        address[] memory allowedTokens = new address[](1);
        allowedTokens[0] = address(token);
        marketplace = new PayflowJobMarketplace(address(factory), allowedTokens);
        verifier = new AlwaysVerifier();
        requester = new JobUser();
        worker = new JobUser();
        resolver = new JobUser();
        requester.createAgent(factory, "Requester agent");
        worker.createAgent(factory, "Worker agent");
        token.mint(address(requester), 500e6);
        requester.approve(token, address(marketplace), 500e6);
    }

    function testRequesterApprovalPaysWorkerFromEscrow() public {
        uint256 jobId = requester.post(
            marketplace,
            address(token),
            address(0),
            address(resolver),
            PayflowJobMarketplace.VerificationMode.RequesterApproval
        );
        requester.fund(marketplace, jobId);
        worker.accept(marketplace, jobId);
        worker.submit(marketplace, jobId);
        requester.approveWork(marketplace, jobId);

        require(marketplace.getJob(jobId).status == PayflowJobMarketplace.Status.Completed, "not completed");
        require(token.balanceOf(address(worker)) == 100e6, "worker unpaid");
        require(token.balanceOf(address(marketplace)) == 0, "escrow retained");
    }

    function testExternalVerifierCompletesAtomically() public {
        uint256 jobId = requester.post(
            marketplace,
            address(token),
            address(verifier),
            address(0),
            PayflowJobMarketplace.VerificationMode.ExternalVerifier
        );
        requester.fund(marketplace, jobId);
        worker.accept(marketplace, jobId);
        worker.submit(marketplace, jobId);
        require(marketplace.getJob(jobId).status == PayflowJobMarketplace.Status.Completed, "not verified");
        require(token.balanceOf(address(worker)) == 100e6, "worker unpaid");
    }

    function testInvalidExternalProofDoesNotConsumeEscrow() public {
        verifier.setResult(false);
        uint256 jobId = requester.post(
            marketplace,
            address(token),
            address(verifier),
            address(0),
            PayflowJobMarketplace.VerificationMode.ExternalVerifier
        );
        requester.fund(marketplace, jobId);
        worker.accept(marketplace, jobId);
        (bool success,) = address(worker).call(abi.encodeCall(worker.submit, (marketplace, jobId)));
        require(!success, "invalid proof accepted");
        require(marketplace.getJob(jobId).status == PayflowJobMarketplace.Status.Accepted, "status changed");
        require(token.balanceOf(address(marketplace)) == 100e6, "escrow lost");
    }

    function testReviewTimeoutGuaranteesPayment() public {
        uint256 jobId = requester.post(
            marketplace,
            address(token),
            address(0),
            address(resolver),
            PayflowJobMarketplace.VerificationMode.RequesterApproval
        );
        requester.fund(marketplace, jobId);
        worker.accept(marketplace, jobId);
        worker.submit(marketplace, jobId);
        vm.warp(block.timestamp + 1 days + 1);
        worker.claimReview(marketplace, jobId);
        require(token.balanceOf(address(worker)) == 100e6, "timeout unpaid");
    }

    function testDisputeResolverCanRefundRequester() public {
        uint256 jobId = requester.post(
            marketplace,
            address(token),
            address(0),
            address(resolver),
            PayflowJobMarketplace.VerificationMode.RequesterApproval
        );
        requester.fund(marketplace, jobId);
        worker.accept(marketplace, jobId);
        worker.submit(marketplace, jobId);
        requester.reject(marketplace, jobId);
        worker.dispute(marketplace, jobId);
        resolver.resolve(marketplace, jobId, false);
        require(token.balanceOf(address(requester)) == 500e6, "not refunded");
    }

    function testDeadlineRefundsUnfinishedJob() public {
        uint256 jobId = requester.post(
            marketplace,
            address(token),
            address(0),
            address(0),
            PayflowJobMarketplace.VerificationMode.RequesterApproval
        );
        requester.fund(marketplace, jobId);
        worker.accept(marketplace, jobId);
        vm.warp(block.timestamp + 3 days + 1);
        requester.refund(marketplace, jobId);
        require(token.balanceOf(address(requester)) == 500e6, "not refunded");
    }

    function testUnregisteredWorkerCannotAccept() public {
        JobUser stranger = new JobUser();
        uint256 jobId = requester.post(
            marketplace,
            address(token),
            address(0),
            address(0),
            PayflowJobMarketplace.VerificationMode.RequesterApproval
        );
        requester.fund(marketplace, jobId);
        (bool success,) = address(stranger).call(abi.encodeCall(stranger.accept, (marketplace, jobId)));
        require(!success, "unregistered worker accepted");
    }

    function testDisallowedRewardTokenCannotBePosted() public {
        JobToken otherToken = new JobToken();
        PayflowJobMarketplace.JobRequest memory request = PayflowJobMarketplace.JobRequest({
            token: address(otherToken),
            reward: 100e6,
            acceptanceDeadline: uint64(block.timestamp + 1 days),
            workDeadline: uint64(block.timestamp + 3 days),
            reviewPeriod: uint64(1 days),
            verificationMode: PayflowJobMarketplace.VerificationMode.RequesterApproval,
            verifier: address(0),
            resolver: address(0),
            specificationHash: keccak256("unsupported token"),
            metadataURI: "ipfs://unsupported"
        });
        (bool success,) = address(marketplace).call(abi.encodeCall(marketplace.postJob, (address(requester), request)));
        require(!success, "unsupported token accepted");
    }

    function testRequesterCannotRejectWithoutResubmissionWindow() public {
        uint256 jobId = requester.post(
            marketplace,
            address(token),
            address(0),
            address(resolver),
            PayflowJobMarketplace.VerificationMode.RequesterApproval
        );
        requester.fund(marketplace, jobId);
        worker.accept(marketplace, jobId);
        vm.warp(block.timestamp + 2 days + 12 hours);
        worker.submit(marketplace, jobId);
        (bool success,) = address(requester).call(abi.encodeCall(requester.reject, (marketplace, jobId)));
        require(!success, "late rejection accepted");
        vm.warp(block.timestamp + 1 days + 1);
        worker.claimReview(marketplace, jobId);
        require(token.balanceOf(address(worker)) == 100e6, "worker unpaid");
    }

    function testAgentOperatorCanPostAcceptAndSubmitButCannotFund() public {
        PayflowJobMarketplace.JobRequest memory request = PayflowJobMarketplace.JobRequest({
            token: address(token),
            reward: 100e6,
            acceptanceDeadline: uint64(block.timestamp + 1 days),
            workDeadline: uint64(block.timestamp + 3 days),
            reviewPeriod: uint64(1 days),
            verificationMode: PayflowJobMarketplace.VerificationMode.RequesterApproval,
            verifier: address(0),
            resolver: address(resolver),
            specificationHash: keccak256("operator specification"),
            metadataURI: "ipfs://operator-job"
        });
        uint256 jobId = marketplace.postJob(address(requester), request);
        (bool fundedByOperator,) = address(marketplace).call(abi.encodeCall(marketplace.fundJob, (jobId)));
        require(!fundedByOperator, "operator funded owner escrow");
        requester.fund(marketplace, jobId);
        marketplace.acceptJob(jobId, address(worker));
        marketplace.submitWork(jobId, address(worker), keccak256("operator delivery"), "ipfs://operator-delivery", "");
        PayflowJobMarketplace.Job memory job = marketplace.getJob(jobId);
        require(job.workerAgent == factory.agentOf(address(worker)), "worker agent");
        require(job.status == PayflowJobMarketplace.Status.Submitted, "not submitted");
    }
}
