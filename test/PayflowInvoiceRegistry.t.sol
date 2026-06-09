// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PayflowInvoiceRegistry} from "../contracts/PayflowInvoiceRegistry.sol";

contract InvoiceIssuer {
    function create(
        PayflowInvoiceRegistry registry,
        bytes32 invoiceId
    ) external {
        registry.createInvoice(
            invoiceId,
            address(this),
            address(0x1234),
            100e6,
            uint64(block.timestamp + 7 days),
            keccak256("metadata")
        );
    }
}

contract PayflowInvoiceRegistryTest {
    PayflowInvoiceRegistry private registry;

    function setUp() public {
        registry = new PayflowInvoiceRegistry();
    }

    function testCreateAndCancelInvoice() public {
        bytes32 invoiceId = keccak256("INV-1");
        registry.createInvoice(
            invoiceId,
            address(this),
            address(0x1234),
            100e6,
            uint64(block.timestamp + 7 days),
            keccak256("metadata")
        );

        (
            address issuer,
            address recipient,
            address token,
            uint256 amount,
            uint64 createdAt,
            ,
            bytes32 metadataHash,
            PayflowInvoiceRegistry.Status status
        ) = registry.invoices(invoiceId);

        require(issuer == address(this), "issuer");
        require(recipient == address(this), "recipient");
        require(token == address(0x1234), "token");
        require(amount == 100e6, "amount");
        require(createdAt > 0, "createdAt");
        require(metadataHash == keccak256("metadata"), "metadata");
        require(status == PayflowInvoiceRegistry.Status.Pending, "status");

        registry.cancelInvoice(invoiceId);
        (, , , , , , , status) = registry.invoices(invoiceId);
        require(status == PayflowInvoiceRegistry.Status.Cancelled, "cancelled");
    }

    function testAgentOperatorCanReconcileAnotherIssuersInvoice() public {
        InvoiceIssuer issuer = new InvoiceIssuer();
        bytes32 invoiceId = keccak256("INV-AGENT");
        bytes32 paymentTxReference = keccak256("payment");
        issuer.create(registry, invoiceId);

        registry.markPaid(invoiceId, paymentTxReference);

        (, , , , , , , PayflowInvoiceRegistry.Status status) = registry
            .invoices(invoiceId);
        require(status == PayflowInvoiceRegistry.Status.Paid, "paid");
    }
}
