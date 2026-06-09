// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PayflowAgent {
    address public immutable owner;
    address public operator;
    string public name;
    uint32 public reminderDelay;
    bool public automationEnabled;

    event AgentUpdated(string name, address indexed operator, uint32 reminderDelay, bool automationEnabled);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address owner_, address operator_, string memory name_, uint32 reminderDelay_) {
        require(owner_ != address(0) && operator_ != address(0), "Invalid address");
        owner = owner_;
        operator = operator_;
        name = name_;
        reminderDelay = reminderDelay_;
        automationEnabled = true;
    }

    function update(string calldata name_, address operator_, uint32 reminderDelay_, bool automationEnabled_)
        external
        onlyOwner
    {
        require(operator_ != address(0), "Invalid operator");
        name = name_;
        operator = operator_;
        reminderDelay = reminderDelay_;
        automationEnabled = automationEnabled_;
        emit AgentUpdated(name_, operator_, reminderDelay_, automationEnabled_);
    }

    function canOperate(address account) external view returns (bool) {
        return automationEnabled && account == operator;
    }
}
