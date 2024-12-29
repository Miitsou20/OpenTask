// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract MockReceiver {
    receive() external payable {
        revert("Mock receiver: transfer rejected");
    }

    function withdraw(address treasury, uint256 amount) external {
        (bool success, ) = treasury.call{value: 0}(
            abi.encodeWithSignature("withdraw(uint256)", amount)
        );
        require(success, "Withdrawal failed");
    }
} 