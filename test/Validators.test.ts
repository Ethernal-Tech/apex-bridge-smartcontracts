import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Validators Contract", function () {
  it("addValidatorChainData from Validators SC should revert if not called by Bridge SC", async function () {
    await expect(
      validatorsc.connect(owner).addValidatorChainData(1, owner.address, validatorCardanoData)
    ).to.be.revertedWithCustomError(bridge, "NotRegistration");
  });

  it("setValidatorsChainData from Validators SC should revert if not called by Bridge SC", async function () {
    await expect(
      validatorsc.connect(owner).setValidatorsChainData(1, validatorAddressChainData)
    ).to.be.revertedWithCustomError(bridge, "NotRegistration");
  });

  let bridge: any;
  let owner: any;
  let validatorsc: any;
  let validatorCardanoData: any;
  let validatorAddressChainData: any;

  beforeEach(async function () {
    const fixture = await loadFixture(deployBridgeFixture);

    bridge = fixture.bridge;
    owner = fixture.owner;
    validatorsc = fixture.validatorsc;
    validatorCardanoData = fixture.validatorCardanoData;
    validatorAddressChainData = fixture.validatorAddressChainData;
  });
});
