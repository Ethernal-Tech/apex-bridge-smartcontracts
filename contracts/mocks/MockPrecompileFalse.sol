// contracts/MockPrecompile2050.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockPrecompileFalse {
    // 🚨 FIX: Change the signature to include the required bytes calldata argument
    // The name of the argument (like 'data') doesn't matter, but the type does.
    fallback(bytes calldata /*data*/) external returns (bytes memory) {
        // Encode: (bool success, bytes memory returnData)
        // returnData itself is abi.encode(true)
        bytes memory innerData = abi.encode(false);
        bytes memory result = abi.encode(false, innerData);
        return result;
    }
}
