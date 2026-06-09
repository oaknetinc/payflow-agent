// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PayflowAgentFactory} from "../contracts/PayflowAgentFactory.sol";
import {PayflowInvoiceRegistry} from "../contracts/PayflowInvoiceRegistry.sol";
import {PayflowPaymentRouter} from "../contracts/PayflowPaymentRouter.sol";

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
        returns (PayflowAgentFactory factory, PayflowInvoiceRegistry registry, PayflowPaymentRouter router)
    {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address operator = vm.addr(deployerKey);
        vm.startBroadcast(deployerKey);
        factory = new PayflowAgentFactory(operator);
        registry = new PayflowInvoiceRegistry(address(factory));
        router = new PayflowPaymentRouter(address(registry));
        registry.setPaymentRouter(address(router));
        vm.stopBroadcast();
    }
}
