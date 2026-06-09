// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PayflowInvoiceRegistry} from "../contracts/PayflowInvoiceRegistry.sol";

interface Vm {
    function envUint(string calldata key) external returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployPayflow {
    Vm private constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (PayflowInvoiceRegistry registry) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        registry = new PayflowInvoiceRegistry();
        vm.stopBroadcast();
    }
}
