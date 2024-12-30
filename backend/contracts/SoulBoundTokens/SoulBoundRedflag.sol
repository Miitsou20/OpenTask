// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

/**
 * @title SoulBound Redflag Contract
 * @author Damien Schneider
 * @notice This contract manages redflag NFTs for developers who lost disputes
 * @dev Implements non-transferable redflag tokens with dispute tracking
 */
contract SoulBoundRedflag is ERC721, Ownable {
  uint256 private _tokenIdCounter = 1;

  struct Redflag {
    uint256[] disputeDates;
    uint256 totalDisputes;
  }

  mapping(address => Redflag) public developerRedflag;
  mapping(uint256 => address) public tokenToDeveloper;

  event RedflagMinted(address indexed developer, uint256 tokenId, uint256 disputeDate);
  event DisputeLost(address indexed developer, uint256 disputeDate);

  constructor() ERC721('DeveloperRedflag', 'DREF') Ownable(msg.sender) {}

  /**
   * @notice Records a lost dispute for a developer
   * @dev Only callable by owner (TaskMarketplace contract)
   * @param developer Address of the developer who lost the dispute
   */
  function recordLostDispute(address developer) external onlyOwner {
    Redflag storage redflag = developerRedflag[developer];
    redflag.disputeDates.push(block.timestamp);
    redflag.totalDisputes++;

    emit DisputeLost(developer, block.timestamp);

    // Mint redflag token if developer reaches 3 lost disputes and doesn't have one yet
    if (redflag.totalDisputes >= 3 && balanceOf(developer) == 0) {
      uint256 tokenId = _tokenIdCounter++;
      tokenToDeveloper[tokenId] = developer;
      _safeMint(developer, tokenId);
      emit RedflagMinted(developer, tokenId, block.timestamp);
    }
  }

  /**
   * @notice Gets the dispute history for a developer
   * @param developer Address of the developer
   * @return dates Array of dispute dates
   * @return total Total number of lost disputes
   */
  function getDisputeHistory(
    address developer
  ) external view returns (uint256[] memory dates, uint256 total) {
    Redflag storage redflag = developerRedflag[developer];
    return (redflag.disputeDates, redflag.totalDisputes);
  }

  /**
   * @notice Override of ERC721 _update to prevent token transfers
   * @dev Implements the "soulbound" aspect of the token
   */
  function _update(
    address to,
    uint256 tokenId,
    address auth
  ) internal override(ERC721) returns (address) {
    address from = _ownerOf(tokenId);
    if (from != address(0) && to != address(0)) {
      revert('SoulBound: Transfer not allowed');
    }
    return super._update(to, tokenId, auth);
  }
}
