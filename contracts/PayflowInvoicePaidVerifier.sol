// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPayflowVerifierInvoiceRegistry {
    function paymentDetails(bytes32 invoiceId)
        external
        view
        returns (address recipient, address token, uint256 amount, uint8 status);
}

contract PayflowInvoicePaidVerifier {
    IPayflowVerifierInvoiceRegistry public immutable registry;

    constructor(address registry_) {
        require(registry_ != address(0), "Invalid registry");
        registry = IPayflowVerifierInvoiceRegistry(registry_);
    }

    function verify(uint256, address, address, bytes32 specificationHash, bytes32 deliverableHash, bytes calldata proof)
        external
        view
        returns (bool)
    {
        bytes32 invoiceId = abi.decode(proof, (bytes32));
        if (specificationHash != keccak256(abi.encode(invoiceId))) return false;
        (,,, uint8 status) = registry.paymentDetails(invoiceId);
        return status == 1 && deliverableHash == keccak256(abi.encode(invoiceId, status));
    }
}
