import hre from "hardhat";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("Validators Contract", function () {
  it("addValidatorChainData from Validators SC should revert if not called by Bridge SC", async function () {
    await expect(
      validatorsc.connect(owner).addValidatorChainData(1, owner.address, validatorCardanoData)
    ).to.be.revertedWithCustomError(bridge, "NotBridge");
  });

  it("setValidatorsChainData from Validators SC should revert if not called by Bridge SC", async function () {
    await expect(
      validatorsc.connect(owner).setValidatorsChainData(1, validatorAddressChainData)
    ).to.be.revertedWithCustomError(bridge, "NotBridge");
  });

  let bridge;
  let owner;
  let validatorsc;
  let validatorCardanoData;
  let validatorAddressChainData;
  let fixture;

  beforeEach(async function () {
    fixture = await deployBridgeFixture(hre);

    bridge = fixture.bridge;
    owner = fixture.owner;
    validatorsc = fixture.validatorsc;
    validatorCardanoData = fixture.validatorCardanoData;
    validatorAddressChainData = fixture.validatorAddressChainData;
  });
});
