// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PayflowJobMarketplace} from "../contracts/PayflowJobMarketplace.sol";
import {PayflowInvoicePaidVerifier} from "../contracts/PayflowInvoicePaidVerifier.sol";

interface VmJobDeploy {
    function envUint(string calldata key) external returns (uint256);
    function envAddress(string calldata key) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployJobMarketplace {
    VmJobDeploy private constant vm = VmJobDeploy(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (PayflowJobMarketplace marketplace, PayflowInvoicePaidVerifier invoiceVerifier) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address agentFactory = vm.envAddress("AGENT_FACTORY_ADDRESS");
        address invoiceRegistry = vm.envAddress("INVOICE_REGISTRY_ADDRESS");
        address[] memory allowedTokens = new address[](3);
        allowedTokens[0] = 0xcebA9300f2b948710d2653dD7B07f33A8B32118C;
        allowedTokens[1] = 0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e;
        allowedTokens[2] = 0x765DE816845861e75A25fCA122bb6898B8B1282a;

        vm.startBroadcast(deployerKey);
        marketplace = new PayflowJobMarketplace(agentFactory, allowedTokens);
        invoiceVerifier = new PayflowInvoicePaidVerifier(invoiceRegistry);
        vm.stopBroadcast();
    }
}
