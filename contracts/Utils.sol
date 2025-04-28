// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Utils {
    function _isContract(address addr) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }
}
