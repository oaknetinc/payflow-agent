// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PayflowAgentFactory} from "../contracts/PayflowAgentFactory.sol";
import {PayflowInvoiceRegistry} from "../contracts/PayflowInvoiceRegistry.sol";
import {PayflowPaymentRouter} from "../contracts/PayflowPaymentRouter.sol";
import {PayflowJobMarketplace} from "../contracts/PayflowJobMarketplace.sol";
import {PayflowInvoicePaidVerifier} from "../contracts/PayflowInvoicePaidVerifier.sol";

interface Vm {
    function envUint(string calldata key) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
    function addr(uint256 privateKey) external returns (address);
}

contract DeployPayflow {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run()
        external
        returns (
            PayflowAgentFactory factory,
            PayflowInvoiceRegistry registry,
            PayflowPaymentRouter router,
            PayflowJobMarketplace marketplace,
            PayflowInvoicePaidVerifier invoiceVerifier
        )
    {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address operator = vm.addr(deployerKey);
        address[] memory allowedTokens = new address[](3);
        allowedTokens[0] = 0xcebA9300f2b948710d2653dD7B07f33A8B32118C;
        allowedTokens[1] = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;
        allowedTokens[2] = 0x765DE816845861e75A25fCA122bb6898B8B1282a;
        vm.startBroadcast(deployerKey);
        factory = new PayflowAgentFactory(operator);
        registry = new PayflowInvoiceRegistry(address(factory));
        router = new PayflowPaymentRouter(address(registry));
        registry.setPaymentRouter(address(router));
        marketplace = new PayflowJobMarketplace(address(factory), allowedTokens);
        invoiceVerifier = new PayflowInvoicePaidVerifier(address(registry));
        vm.stopBroadcast();
    }
}
