// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PayflowAgent} from "./PayflowAgent.sol";

contract PayflowAgentFactory {
    address public immutable defaultOperator;
    mapping(address owner => address agent) public agentOf;

    event AgentCreated(address indexed owner, address indexed agent, address indexed operator, string name);

    constructor(address defaultOperator_) {
        require(defaultOperator_ != address(0), "Invalid operator");
        defaultOperator = defaultOperator_;
    }

    function createAgent(string calldata name, uint32 reminderDelay) external returns (address agent) {
        require(agentOf[msg.sender] == address(0), "Agent exists");
        agent = address(new PayflowAgent(msg.sender, defaultOperator, name, reminderDelay));
        agentOf[msg.sender] = agent;
        emit AgentCreated(msg.sender, agent, defaultOperator, name);
    }

    function isOperatorFor(address owner, address operator) external view returns (bool) {
        address agent = agentOf[owner];
        return agent != address(0) && PayflowAgent(agent).canOperate(operator);
    }
}
