// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPayflowAgentFactory {
    function isOperatorFor(address owner, address operator) external view returns (bool);
}

contract PayflowInvoiceRegistry {
    IPayflowAgentFactory public immutable agentFactory;
    address public immutable deployer;
    address public paymentRouter;

    enum Status {
        Pending,
        Paid,
        Cancelled
    }

    struct Invoice {
        address issuer;
        address recipient;
        address token;
        uint256 amount;
        uint64 createdAt;
        uint64 dueAt;
        uint64 lastReminderAt;
        bytes32 paymentTxReference;
        Status status;
        string metadata;
    }

    mapping(bytes32 invoiceId => Invoice invoice) public invoices;

    event InvoiceCreated(
        bytes32 indexed invoiceId,
        address indexed issuer,
        address indexed recipient,
        address token,
        uint256 amount,
        uint64 dueAt,
        string metadata
    );
    event InvoicePaid(bytes32 indexed invoiceId, bytes32 paymentTxReference);
    event InvoiceCancelled(bytes32 indexed invoiceId);
    event ReminderRecorded(bytes32 indexed invoiceId, uint64 remindedAt);
    event PaymentRouterConfigured(address indexed paymentRouter);

    constructor(address agentFactory_) {
        require(agentFactory_ != address(0), "Invalid factory");
        agentFactory = IPayflowAgentFactory(agentFactory_);
        deployer = msg.sender;
    }

    function setPaymentRouter(address paymentRouter_) external {
        require(msg.sender == deployer, "Only deployer");
        require(paymentRouter == address(0), "Router already set");
        require(paymentRouter_ != address(0), "Invalid router");
        paymentRouter = paymentRouter_;
        emit PaymentRouterConfigured(paymentRouter_);
    }

    function createInvoice(
        bytes32 invoiceId,
        address recipient,
        address token,
        uint256 amount,
        uint64 dueAt,
        string calldata metadata
    ) external {
        require(invoices[invoiceId].issuer == address(0), "Invoice exists");
        require(recipient != address(0) && token != address(0), "Invalid address");
        require(amount > 0, "Invalid amount");

        invoices[invoiceId] = Invoice({
            issuer: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            createdAt: uint64(block.timestamp),
            dueAt: dueAt,
            lastReminderAt: 0,
            paymentTxReference: bytes32(0),
            status: Status.Pending,
            metadata: metadata
        });

        emit InvoiceCreated(invoiceId, msg.sender, recipient, token, amount, dueAt, metadata);
    }

    function markPaid(bytes32 invoiceId, bytes32 paymentTxReference) external {
        Invoice storage invoice = invoices[invoiceId];
        require(msg.sender == paymentRouter || _canOperate(invoice.issuer), "Not authorized");
        require(invoice.status == Status.Pending, "Not pending");
        require(paymentTxReference != bytes32(0), "Invalid payment");
        invoice.paymentTxReference = paymentTxReference;
        invoice.status = Status.Paid;
        emit InvoicePaid(invoiceId, paymentTxReference);
    }

    function recordReminder(bytes32 invoiceId) external {
        Invoice storage invoice = invoices[invoiceId];
        require(_canOperate(invoice.issuer), "Not authorized");
        require(invoice.status == Status.Pending, "Not pending");
        invoice.lastReminderAt = uint64(block.timestamp);
        emit ReminderRecorded(invoiceId, uint64(block.timestamp));
    }

    function cancelInvoice(bytes32 invoiceId) external {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.issuer == msg.sender, "Only issuer");
        require(invoice.status == Status.Pending, "Not pending");
        invoice.status = Status.Cancelled;
        emit InvoiceCancelled(invoiceId);
    }

    function paymentDetails(bytes32 invoiceId)
        external
        view
        returns (address recipient, address token, uint256 amount, uint8 status)
    {
        Invoice storage invoice = invoices[invoiceId];
        return (invoice.recipient, invoice.token, invoice.amount, uint8(invoice.status));
    }

    function _canOperate(address issuer) private view returns (bool) {
        return issuer == msg.sender || agentFactory.isOperatorFor(issuer, msg.sender);
    }
}
