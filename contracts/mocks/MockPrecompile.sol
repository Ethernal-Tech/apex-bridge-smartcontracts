// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

contract MockPrecompile {
    bool private returnValue;

    constructor(bool _returnValue) {
        returnValue = _returnValue;
    }

    function callPrecompile() external view returns (bool) {
        return returnValue;
    }
}
