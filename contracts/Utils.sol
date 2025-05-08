// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Utils
/// @notice Utility functions for contract operations.
contract Utils {
    /// @notice Checks whether a given address is a contract.
    /// @dev Uses `extcodesize` to determine if the address contains contract code.
    ///      This method returns false for contracts in construction, as their code is only stored at the end of the constructor.
    /// @param addr The address to check.
    /// @return isContract A boolean value indicating whether the address is a contract.
    function _isContract(address addr) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }
}
