// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/AgentBountyBoard.sol";

contract DeployAgentBountyBoard is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        // CLAWD token on Base: 0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07
        // For local fork testing, this address will have the real CLAWD state
        address clawdToken = 0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07;
        
        new AgentBountyBoard(clawdToken);
    }
}
