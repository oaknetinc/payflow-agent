// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PayflowInvoiceRegistry {
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
        uint64 dueAt;
        bytes32 metadataHash;
        Status status;
    }

    mapping(bytes32 invoiceId => Invoice invoice) public invoices;

    event InvoiceCreated(
        bytes32 indexed invoiceId,
        address indexed issuer,
        address indexed recipient,
        address token,
        uint256 amount,
        uint64 dueAt,
        bytes32 metadataHash
    );
    event InvoicePaid(bytes32 indexed invoiceId, bytes32 paymentTxReference);
    event InvoiceCancelled(bytes32 indexed invoiceId);

    function createInvoice(
        bytes32 invoiceId,
        address recipient,
        address token,
        uint256 amount,
        uint64 dueAt,
        bytes32 metadataHash
    ) external {
        require(invoices[invoiceId].issuer == address(0), "Invoice exists");
        require(recipient != address(0) && token != address(0), "Invalid address");
        require(amount > 0, "Invalid amount");

        invoices[invoiceId] = Invoice({
            issuer: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            dueAt: dueAt,
            metadataHash: metadataHash,
            status: Status.Pending
        });

        emit InvoiceCreated(
            invoiceId,
            msg.sender,
            recipient,
            token,
            amount,
            dueAt,
            metadataHash
        );
    }

    function markPaid(bytes32 invoiceId, bytes32 paymentTxReference) external {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.issuer == msg.sender, "Only issuer");
        require(invoice.status == Status.Pending, "Not pending");
        invoice.status = Status.Paid;
        emit InvoicePaid(invoiceId, paymentTxReference);
    }

    function cancelInvoice(bytes32 invoiceId) external {
        Invoice storage invoice = invoices[invoiceId];
        require(invoice.issuer == msg.sender, "Only issuer");
        require(invoice.status == Status.Pending, "Not pending");
        invoice.status = Status.Cancelled;
        emit InvoiceCancelled(invoiceId);
    }
}
