import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Deployment", function () {
  it("Should set 5 validator with quorum of 4", async function () {
    const { validatorsc } = await loadFixture(deployBridgeFixture);
    const quorumNumberOfValidators = await validatorsc.getQuorumNumberOfValidators();

    expect(quorumNumberOfValidators).to.equal(4);
  });
});
