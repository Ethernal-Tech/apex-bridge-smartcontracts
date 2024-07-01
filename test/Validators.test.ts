import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Validators Contract", function () {
  it("addValidatorChainData from Validators SC should revert if not called by Bridge SC", async function () {
    const { bridge, validatorsc, owner, validatorCardanoData } = await loadFixture(deployBridgeFixture);

    await expect(
      validatorsc.connect(owner).addValidatorChainData(1, owner.address, validatorCardanoData)
    ).to.be.revertedWithCustomError(bridge, "NotBridge");
  });

  it("setValidatorsChainData from Validators SC should revert if not called by Bridge SC", async function () {
    const { bridge, validatorsc, owner, validatorAddressCardanoData } = await loadFixture(deployBridgeFixture);

    await expect(
      validatorsc.connect(owner).setValidatorsChainData(1, validatorAddressCardanoData)
    ).to.be.revertedWithCustomError(bridge, "NotBridge");
  });
});
