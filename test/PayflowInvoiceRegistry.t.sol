// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PayflowAgent} from "../contracts/PayflowAgent.sol";
import {PayflowAgentFactory} from "../contracts/PayflowAgentFactory.sol";
import {PayflowInvoiceRegistry} from "../contracts/PayflowInvoiceRegistry.sol";
import {PayflowPaymentRouter} from "../contracts/PayflowPaymentRouter.sol";

contract TestToken {
    mapping(address account => uint256 balance) public balanceOf;
    mapping(address owner => mapping(address spender => uint256 amount)) public allowance;

    function mint(address account, uint256 amount) external {
        balanceOf[account] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
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

contract User {
    function createAgent(PayflowAgentFactory factory) external returns (address) {
        return factory.createAgent("My Payflow Agent", 3 days);
    }

    function createInvoice(PayflowInvoiceRegistry registry, bytes32 invoiceId, address token) external {
        registry.createInvoice(
            invoiceId,
            address(this),
            token,
            100e6,
            uint64(block.timestamp + 7 days),
            '{"client":"Acme","description":"Design","currency":"USDC"}'
        );
    }

    function pay(TestToken token, PayflowPaymentRouter router, bytes32 invoiceId) external {
        token.approve(address(router), 100e6);
        router.payInvoice(invoiceId);
    }
}

contract PayflowInvoiceRegistryTest {
    PayflowAgentFactory private factory;
    PayflowInvoiceRegistry private registry;
    PayflowPaymentRouter private router;
    TestToken private token;
    User private user;

    function setUp() public {
        factory = new PayflowAgentFactory(address(this));
        registry = new PayflowInvoiceRegistry(address(factory));
        router = new PayflowPaymentRouter(address(registry));
        registry.setPaymentRouter(address(router));
        token = new TestToken();
        user = new User();
    }

    function testUserCreatesOwnedAgent() public {
        address agentAddress = user.createAgent(factory);
        PayflowAgent agent = PayflowAgent(agentAddress);
        require(agent.owner() == address(user), "owner");
        require(agent.operator() == address(this), "operator");
        require(agent.automationEnabled(), "automation");
        require(factory.agentOf(address(user)) == agentAddress, "factory");
    }

    function testAgentOperatorReconcilesAndRecordsReminder() public {
        user.createAgent(factory);
        bytes32 invoiceId = keccak256("INV-AGENT");
        bytes32 paymentTxReference = keccak256("payment");
        user.createInvoice(registry, invoiceId, address(token));

        registry.recordReminder(invoiceId);
        (,,,,,, uint64 lastReminderAt,,,) = registry.invoices(invoiceId);
        require(lastReminderAt > 0, "reminder");

        registry.markPaid(invoiceId, paymentTxReference);
        (,,,,,,, bytes32 paymentReference, PayflowInvoiceRegistry.Status status,) = registry.invoices(invoiceId);
        require(paymentReference == paymentTxReference, "reference");
        require(status == PayflowInvoiceRegistry.Status.Paid, "paid");
    }

    function testDuplicateAgentIsRejected() public {
        user.createAgent(factory);
        (bool success,) = address(user).call(abi.encodeCall(user.createAgent, (factory)));
        require(!success, "duplicate agent");
    }

    function testRouterBindsPaymentToInvoice() public {
        bytes32 invoiceId = keccak256("INV-PAY");
        user.createInvoice(registry, invoiceId, address(token));
        token.mint(address(user), 100e6);
        user.pay(token, router, invoiceId);

        (,,,,,,, bytes32 paymentReference, PayflowInvoiceRegistry.Status status,) = registry.invoices(invoiceId);
        require(paymentReference != bytes32(0), "payment reference");
        require(status == PayflowInvoiceRegistry.Status.Paid, "paid");
        require(token.balanceOf(address(user)) == 100e6, "recipient balance");
    }
}
