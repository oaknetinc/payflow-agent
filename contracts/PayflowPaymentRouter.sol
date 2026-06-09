// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IPayflowInvoiceRegistry {
    function paymentDetails(bytes32 invoiceId)
        external
        view
        returns (address recipient, address token, uint256 amount, uint8 status);

    function markPaid(bytes32 invoiceId, bytes32 paymentTxReference) external;
}

contract PayflowPaymentRouter {
    IPayflowInvoiceRegistry public immutable registry;

    event InvoicePayment(
        bytes32 indexed invoiceId, address indexed payer, address indexed recipient, address token, uint256 amount
    );

    constructor(address registry_) {
        require(registry_ != address(0), "Invalid registry");
        registry = IPayflowInvoiceRegistry(registry_);
    }

    function payInvoice(bytes32 invoiceId) external {
        (address recipient, address token, uint256 amount, uint8 status) = registry.paymentDetails(invoiceId);
        require(status == 0, "Invoice not pending");
        require(IERC20(token).transferFrom(msg.sender, recipient, amount), "Transfer failed");
        bytes32 paymentReference =
            keccak256(abi.encodePacked(block.chainid, address(this), invoiceId, msg.sender, block.number));
        registry.markPaid(invoiceId, paymentReference);
        emit InvoicePayment(invoiceId, msg.sender, recipient, token, amount);
    }
}
