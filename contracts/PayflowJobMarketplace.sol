// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20JobToken {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IPayflowJobAgentFactory {
    function agentOf(address owner) external view returns (address);
    function isOperatorFor(address owner, address operator) external view returns (bool);
}

interface IPayflowJobVerifier {
    function verify(
        uint256 jobId,
        address requester,
        address worker,
        bytes32 specificationHash,
        bytes32 deliverableHash,
        bytes calldata proof
    ) external view returns (bool);
}

contract PayflowJobMarketplace {
    enum VerificationMode {
        RequesterApproval,
        ExternalVerifier
    }

    enum Status {
        Posted,
        Funded,
        Accepted,
        Submitted,
        Disputed,
        Completed,
        Cancelled,
        Refunded
    }

    struct Job {
        address requester;
        address requesterAgent;
        address worker;
        address workerAgent;
        address token;
        address verifier;
        address resolver;
        uint256 reward;
        uint64 acceptanceDeadline;
        uint64 workDeadline;
        uint64 reviewPeriod;
        uint64 submittedAt;
        VerificationMode verificationMode;
        Status status;
        bytes32 specificationHash;
        bytes32 deliverableHash;
        string metadataURI;
        string deliverableURI;
    }

    struct JobRequest {
        address token;
        uint256 reward;
        uint64 acceptanceDeadline;
        uint64 workDeadline;
        uint64 reviewPeriod;
        VerificationMode verificationMode;
        address verifier;
        address resolver;
        bytes32 specificationHash;
        string metadataURI;
    }

    IPayflowJobAgentFactory public immutable agentFactory;
    uint256 public jobCount;
    uint256 private locked = 1;
    mapping(uint256 jobId => Job job) private jobs;
    mapping(address token => bool allowed) public allowedTokens;

    event JobPosted(
        uint256 indexed jobId,
        address indexed requester,
        address indexed requesterAgent,
        address token,
        uint256 reward,
        VerificationMode verificationMode,
        bytes32 specificationHash,
        string metadataURI
    );
    event JobFunded(uint256 indexed jobId, address indexed requester, uint256 reward);
    event JobAccepted(uint256 indexed jobId, address indexed worker, address indexed workerAgent);
    event WorkSubmitted(
        uint256 indexed jobId, address indexed worker, bytes32 deliverableHash, bytes32 proofHash, string deliverableURI
    );
    event SubmissionRejected(uint256 indexed jobId, address indexed requester, bytes32 reasonHash);
    event JobDisputed(uint256 indexed jobId, address indexed raisedBy, bytes32 reasonHash);
    event DisputeResolved(uint256 indexed jobId, address indexed resolver, bool paidWorker);
    event JobCompleted(uint256 indexed jobId, address indexed worker, uint256 reward);
    event JobCancelled(uint256 indexed jobId);
    event JobRefunded(uint256 indexed jobId, address indexed requester, uint256 reward);

    modifier nonReentrant() {
        require(locked == 1, "Reentrant call");
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address agentFactory_, address[] memory allowedTokens_) {
        require(agentFactory_ != address(0), "Invalid factory");
        require(allowedTokens_.length > 0, "Tokens required");
        agentFactory = IPayflowJobAgentFactory(agentFactory_);
        for (uint256 i = 0; i < allowedTokens_.length; i++) {
            require(allowedTokens_[i] != address(0), "Invalid token");
            allowedTokens[allowedTokens_[i]] = true;
        }
    }

    function postJob(address requester, JobRequest calldata request) external returns (uint256 jobId) {
        require(_canAct(requester), "Not requester agent");
        require(agentFactory.agentOf(requester) != address(0), "Requester agent required");
        require(allowedTokens[request.token] && request.reward > 0, "Invalid reward");
        require(request.acceptanceDeadline > block.timestamp, "Invalid acceptance deadline");
        require(request.workDeadline > request.acceptanceDeadline, "Invalid work deadline");
        require(request.reviewPeriod > 0, "Invalid review period");
        require(request.specificationHash != bytes32(0), "Invalid specification");
        if (request.verificationMode == VerificationMode.ExternalVerifier) {
            require(request.verifier != address(0), "Verifier required");
        } else {
            require(request.verifier == address(0), "Unexpected verifier");
        }

        jobId = ++jobCount;
        address requesterAgent = agentFactory.agentOf(requester);
        jobs[jobId] = Job({
            requester: requester,
            requesterAgent: requesterAgent,
            worker: address(0),
            workerAgent: address(0),
            token: request.token,
            verifier: request.verifier,
            resolver: request.resolver,
            reward: request.reward,
            acceptanceDeadline: request.acceptanceDeadline,
            workDeadline: request.workDeadline,
            reviewPeriod: request.reviewPeriod,
            submittedAt: 0,
            verificationMode: request.verificationMode,
            status: Status.Posted,
            specificationHash: request.specificationHash,
            deliverableHash: bytes32(0),
            metadataURI: request.metadataURI,
            deliverableURI: ""
        });

        emit JobPosted(
            jobId,
            requester,
            requesterAgent,
            request.token,
            request.reward,
            request.verificationMode,
            request.specificationHash,
            request.metadataURI
        );
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    function fundJob(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.requester == msg.sender, "Only requester");
        require(job.status == Status.Posted, "Not posted");
        require(block.timestamp < job.acceptanceDeadline, "Acceptance expired");
        uint256 balanceBefore = IERC20JobToken(job.token).balanceOf(address(this));
        job.status = Status.Funded;
        _safeTransferFrom(job.token, job.requester, address(this), job.reward);
        require(
            IERC20JobToken(job.token).balanceOf(address(this)) == balanceBefore + job.reward, "Incorrect escrow amount"
        );
        emit JobFunded(jobId, job.requester, job.reward);
    }

    function acceptJob(uint256 jobId, address worker) external {
        Job storage job = jobs[jobId];
        require(_canAct(worker), "Not worker agent");
        require(job.status == Status.Funded, "Not funded");
        require(block.timestamp < job.acceptanceDeadline, "Acceptance expired");
        require(worker != job.requester, "Requester cannot accept");
        address workerAgent = agentFactory.agentOf(worker);
        require(workerAgent != address(0), "Worker agent required");
        job.worker = worker;
        job.workerAgent = workerAgent;
        job.status = Status.Accepted;
        emit JobAccepted(jobId, worker, workerAgent);
    }

    function submitWork(
        uint256 jobId,
        address worker,
        bytes32 deliverableHash,
        string calldata deliverableURI,
        bytes calldata proof
    ) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.worker == worker && _canAct(worker), "Not worker agent");
        require(job.status == Status.Accepted, "Not accepted");
        require(block.timestamp <= job.workDeadline, "Work deadline passed");
        require(deliverableHash != bytes32(0), "Invalid deliverable");

        job.deliverableHash = deliverableHash;
        job.deliverableURI = deliverableURI;
        job.submittedAt = uint64(block.timestamp);
        job.status = Status.Submitted;
        emit WorkSubmitted(jobId, worker, deliverableHash, keccak256(proof), deliverableURI);

        if (job.verificationMode == VerificationMode.ExternalVerifier) {
            require(
                IPayflowJobVerifier(job.verifier)
                    .verify(jobId, job.requester, worker, job.specificationHash, deliverableHash, proof),
                "Proof not verified"
            );
            _complete(jobId, job);
        }
    }

    function approveWork(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.requester == msg.sender, "Only requester");
        require(job.verificationMode == VerificationMode.RequesterApproval, "Externally verified");
        require(job.status == Status.Submitted, "Not submitted");
        _complete(jobId, job);
    }

    function claimReviewTimeout(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.worker == msg.sender, "Only worker");
        require(job.verificationMode == VerificationMode.RequesterApproval, "Externally verified");
        require(job.status == Status.Submitted, "Not submitted");
        require(block.timestamp > uint256(job.submittedAt) + job.reviewPeriod, "Review active");
        _complete(jobId, job);
    }

    function rejectSubmission(uint256 jobId, bytes32 reasonHash) external {
        Job storage job = jobs[jobId];
        require(job.requester == msg.sender, "Only requester");
        require(job.verificationMode == VerificationMode.RequesterApproval, "Externally verified");
        require(job.status == Status.Submitted, "Not submitted");
        require(block.timestamp <= uint256(job.submittedAt) + job.reviewPeriod, "Review expired");
        require(block.timestamp <= job.workDeadline, "Work deadline passed");
        require(block.timestamp + job.reviewPeriod <= job.workDeadline, "No resubmission window");
        job.status = Status.Accepted;
        emit SubmissionRejected(jobId, msg.sender, reasonHash);
    }

    function raiseDispute(uint256 jobId, bytes32 reasonHash) external {
        Job storage job = jobs[jobId];
        require(job.resolver != address(0), "No resolver");
        require(msg.sender == job.requester || msg.sender == job.worker, "Not a party");
        require(job.status == Status.Submitted || job.status == Status.Accepted, "Cannot dispute");
        job.status = Status.Disputed;
        emit JobDisputed(jobId, msg.sender, reasonHash);
    }

    function resolveDispute(uint256 jobId, bool payWorker) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.resolver == msg.sender, "Only resolver");
        require(job.status == Status.Disputed, "Not disputed");
        emit DisputeResolved(jobId, msg.sender, payWorker);
        if (payWorker) {
            _complete(jobId, job);
        } else {
            _refund(jobId, job);
        }
    }

    function cancelPostedJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(job.requester == msg.sender, "Only requester");
        require(job.status == Status.Posted, "Not posted");
        job.status = Status.Cancelled;
        emit JobCancelled(jobId);
    }

    function cancelFundedJob(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.requester == msg.sender, "Only requester");
        require(job.status == Status.Funded, "Not funded");
        _refund(jobId, job);
    }

    function claimDeadlineRefund(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.requester == msg.sender, "Only requester");
        bool acceptanceExpired = job.status == Status.Funded && block.timestamp >= job.acceptanceDeadline;
        bool workExpired = job.status == Status.Accepted && block.timestamp > job.workDeadline;
        require(acceptanceExpired || workExpired, "Deadline active");
        _refund(jobId, job);
    }

    function _complete(uint256 jobId, Job storage job) private {
        job.status = Status.Completed;
        _safeTransfer(job.token, job.worker, job.reward);
        emit JobCompleted(jobId, job.worker, job.reward);
    }

    function _refund(uint256 jobId, Job storage job) private {
        job.status = Status.Refunded;
        _safeTransfer(job.token, job.requester, job.reward);
        emit JobRefunded(jobId, job.requester, job.reward);
    }

    function _canAct(address owner) private view returns (bool) {
        return msg.sender == owner || agentFactory.isOperatorFor(owner, msg.sender);
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool success, bytes memory result) = token.call(abi.encodeCall(IERC20JobToken.transfer, (to, amount)));
        require(success && (result.length == 0 || abi.decode(result, (bool))), "Transfer failed");
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool success, bytes memory result) =
            token.call(abi.encodeCall(IERC20JobToken.transferFrom, (from, to, amount)));
        require(success && (result.length == 0 || abi.decode(result, (bool))), "Transfer failed");
    }
}
