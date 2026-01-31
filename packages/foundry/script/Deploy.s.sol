//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { DeployAgentBountyBoard } from "./DeployAgentBountyBoard.s.sol";

/**
 * @notice Main deployment script for Agent Bounty Board
 * @dev Run: yarn deploy
 */
contract DeployScript is ScaffoldETHDeploy {
  function run() external {
    DeployAgentBountyBoard deployBountyBoard = new DeployAgentBountyBoard();
    deployBountyBoard.run();
  }
}