// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface ITaskEvents {
  enum TaskStatus {
    Created,
    InProgress,
    Submitted,
    Disputed,
    Completed,
    Cancelled,
    CompletedWithDeveloperWon,
    CompletedWithProviderWon
  }

  event TaskStatusUpdated(uint256 indexed taskId, TaskStatus status);
  event TaskCreated(uint256 indexed taskId, address indexed provider, string title, uint256 reward);
  event TaskStarted(uint256 indexed taskId, uint256 reward, address escrowAddress);
  event TaskCancelled(uint256 indexed taskId);
  event DeveloperSubmitted(uint256 indexed taskId, address indexed developer);
  event AuditorSubmitted(uint256 indexed taskId, address indexed auditor);
  event DeveloperAssigned(uint256 indexed taskId, address indexed developer);
  event AuditorAssigned(uint256 indexed taskId, address indexed auditor);
  event WorkSubmitted(uint256 indexed taskId, address indexed developer, uint256 submissionTime);
  event WorkAccepted(uint256 indexed taskId, address indexed provider, uint256 acceptanceTime);
  event DisputeInitiated(uint256 indexed taskId, address indexed initiator, uint256 disputeTime);
  event AuditorVoteSubmitted(
    uint256 indexed taskId,
    address indexed auditor,
    bool supportsDeveloper
  );
  event DisputeResolved(uint256 indexed taskId, bool developerWon);
  event TaskDeadlineUpdated(uint256 indexed taskId, uint256 newDeadline);
  event DeveloperPenalized(uint256 indexed taskId, address indexed developer);
}
