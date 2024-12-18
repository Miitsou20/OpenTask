// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SoulBound Achievement Contract
 * @author Damien Schneider
 * @notice This contract manages achievement NFTs for developers based on completed tasks
 * @dev Implements non-transferable achievement tokens with automatic minting based on thresholds
 */
contract SoulBoundAchievement is ERC721, Ownable {
    uint256 private _tokenIdCounter = 1;

    enum AchievementType {
        ONE_TASK,
        FIVE_TASKS,
        TEN_TASKS,
        FIFTY_TASKS,
        HUNDRED_TASKS
    }

    uint256[] private thresholds = [1, 5, 10, 50, 100];

    mapping(uint256 => AchievementType) public tokenAchievement;
    mapping(address => mapping(AchievementType => bool)) public hasAchievement;
    mapping(address => uint256) public completedTasks;

    event AchievementMinted(address indexed to, uint256 tokenId, AchievementType achievementType);
    event TaskCompleted(address indexed developer, uint256 totalTasks);

    constructor() ERC721("DeveloperAchievement", "DACH") Ownable(msg.sender) {}

    /**
     * @notice Records a completed task for a developer and checks for achievement unlocks
     * @dev Only callable by owner (TaskMarketplace contract)
     * @param developer Address of the developer who completed the task
     */
    function taskCompleted(address developer) external onlyOwner {
        completedTasks[developer]++;
        emit TaskCompleted(developer, completedTasks[developer]);
        _checkAndMintAchievements(developer);
    }

    /**
     * @notice Internal function to check and mint achievements based on completed tasks
     * @dev Iterates through thresholds and mints new achievements if conditions are met
     * @param developer Address of the developer to check achievements for
     */
    function _checkAndMintAchievements(address developer) private {
        uint256 tasks = completedTasks[developer];
        uint256 thresholdsLength = thresholds.length;
        
        for (uint256 i = 0; i < thresholdsLength; i++) {
            if (tasks >= thresholds[i] && !hasAchievement[developer][AchievementType(i)]) {
                _mintAchievement(developer, AchievementType(i));
            }
        }
    }

    /**
     * @notice Internal function to mint a new achievement token
     * @dev Handles the actual minting process and updates relevant mappings
     * @param to Address to receive the achievement token
     * @param achievementType Type of achievement being minted
     */
    function _mintAchievement(address to, AchievementType achievementType) private {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        tokenAchievement[tokenId] = achievementType;
        hasAchievement[to][achievementType] = true;
        
        emit AchievementMinted(to, tokenId, achievementType);
        _safeMint(to, tokenId);
    }

    /**
     * @notice Override of ERC721 _update to prevent token transfers
     * @dev Implements the "soulbound" aspect of the token
     * @param to Destination address
     * @param tokenId Token ID being updated
     * @param auth Address performing the update
     * @return address The from address
     */
    function _update(address to, uint256 tokenId, address auth) internal override(ERC721) returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("SoulBound: Transfer not allowed");
        }
        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Gets the number of tasks completed by a developer
     * @param developer Address of the developer
     * @return uint256 Number of completed tasks
     */
    function getCompletedTasks(address developer) public view returns (uint256) {
        return completedTasks[developer];
    }

    /**
     * @notice Gets the next achievement threshold for a developer
     * @dev Returns 0 if all achievements are unlocked
     * @param developer Address of the developer
     * @return uint256 Next task threshold or 0 if all achieved
     */
    function getNextAchievementThreshold(address developer) public view returns (uint256) {
        uint256 tasks = completedTasks[developer];
        uint256 thresholdsLength = thresholds.length;
        
        for (uint256 i = 0; i < thresholdsLength; i++) {
            if (tasks < thresholds[i] && !hasAchievement[developer][AchievementType(i)]) {
                return thresholds[i];
            }
        }
        return 0; // All achievements are unlocked
    }
} 