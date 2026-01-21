import hre from "hardhat";
import { expect } from "chai";
import { deployBridgeFixture } from "./fixtures";

describe("submitNewValidatorSet+validatorSetUpdated", function () {
  let validatorsSC;
  let validatorsChainDataPrime;
  let validatorsChainDataVector;
  let chains;
  let validatorsAddresses;
  let validatorsAdditional;
  let contractSigner;
  let connection;
  let fixture;

  const generateKey = function (indx, prefix) {
    return [
      BigInt(prefix + indx * 4).toString(),
      (BigInt(prefix + indx * 4) + 1n).toString(),
      (BigInt(prefix + indx * 4) + 2n).toString(),
      (BigInt(prefix + indx * 4) + 3n).toString(),
    ];
  };

  const generateValidatorChainData = function (addr, indx, prefix) {
    return {
      addr: addr,
      data: {
        key: generateKey(indx, prefix),
      },
      keySignature: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcde5",
      keyFeeSignature: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567898",
    };
  };

  beforeEach(async () => {
    fixture = await deployBridgeFixture(hre);
    connection = fixture.connection;

    const [owner, validator1, validator2, validator3, validator4, validator5, validator6] =
      await connection.ethers.getSigners();
    const ValidatorscProxy = await connection.ethers.getContractFactory("UUPSProxy");
    const Validators = await connection.ethers.getContractFactory("Validators");
    const validatorscLogic = await Validators.deploy();
    validatorsAdditional = validator6;

    validatorsAddresses = [
      validator1.address,
      validator2.address,
      validator3.address,
      validator4.address,
      validator5.address,
    ];

    const validatorsProxy = await ValidatorscProxy.deploy(
      await validatorscLogic.getAddress(),
      Validators.interface.encodeFunctionData("initialize", [owner.address, owner.address, validatorsAddresses])
    );

    validatorsSC = Validators.attach(validatorsProxy.target);

    chains = [
      { id: 1, chainType: 0, addressMultisig: "", addressFeePayer: "" },
      { id: 2, chainType: 0, addressMultisig: "", addressFeePayer: "" },
    ];

    validatorsChainDataPrime = validatorsAddresses.map((addr, index) => generateValidatorChainData(addr, index, 0));
    validatorsChainDataVector = validatorsAddresses.map((addr, index) => generateValidatorChainData(addr, index, 256));

    const fakeBridgeAddr = await validatorscLogic.getAddress();
    //Impersonate the factory to make calls
    contractSigner = await connection.ethers.getSigner(fakeBridgeAddr);

    //To make any call with impersonated, you will need to send some eth
    await connection.ethers.provider.send("hardhat_impersonateAccount", [fakeBridgeAddr]);
    await connection.ethers.provider.send("hardhat_setBalance", [contractSigner.address, "0x56BC75E2D63100000"]);

    await validatorsSC.connect(owner).setDependencies(fakeBridgeAddr);

    await validatorsSC.connect(contractSigner).setValidatorsChainData(1, validatorsChainDataPrime);
    await validatorsSC.connect(contractSigner).setValidatorsChainData(2, validatorsChainDataVector);
  });

  it("add one, removes on index 1 and 3, two chains", async () => {
    const newValidatorSetDelta = {
      addedValidators: [
        {
          chainId: 1,
          validators: [generateValidatorChainData(validatorsAdditional.address, 6, 0)],
        },
        {
          chainId: 2,
          validators: [generateValidatorChainData(validatorsAdditional.address, 6, 256)],
        },
        {
          chainId: 255,
          validators: [generateValidatorChainData(validatorsAdditional.address, 6, 65535)],
        },
      ],
      removedValidators: [validatorsAddresses[1], validatorsAddresses[3]],
    };

    expect(await validatorsSC.validatorsCount()).to.equal(5);
    expect(await validatorsSC.getValidatorsAddresses()).to.deep.equal(validatorsAddresses);

    const chainDataPrimeOld = await validatorsSC.getValidatorsChainData(1);
    const chainDataVectorOld = await validatorsSC.getValidatorsChainData(2);

    await validatorsSC.connect(contractSigner).submitNewValidatorSet(newValidatorSetDelta, chains);
    await validatorsSC.connect(contractSigner).validatorSetUpdated(chains);

    const chainDataPrime = await validatorsSC.getValidatorsChainData(1);
    const chainDataVector = await validatorsSC.getValidatorsChainData(2);

    expect(await validatorsSC.validatorsCount()).to.equal(4);
    expect(chainDataPrime.length).to.equal(4);
    expect(chainDataVector.length).to.equal(4);
    expect(await validatorsSC.getValidatorsAddresses()).to.deep.equal([
      validatorsAddresses[0],
      validatorsAddresses[2],
      validatorsAddresses[4],
      validatorsAdditional.address,
    ]);

    let indx = 0;
    for (let i = 0; i < chainDataPrime.length; i++) {
      const prime = chainDataPrime[i];
      const vector = chainDataVector[i];

      if (i != chainDataPrime.length - 1) {
        expect(prime.key).to.deep.equal(chainDataPrimeOld[indx].key);
        expect(vector.key).to.deep.equal(chainDataVectorOld[indx].key);
      } else {
        expect(prime.key).to.deep.equal(generateKey(6, 0));
        expect(vector.key).to.deep.equal(generateKey(6, 256));
      }

      indx += 1 + (i == 0 || i == 1 ? 1 : 0);
    }
  });

  it("cumulative", async () => {
    const newValidatorSetDelta = {
      addedValidators: [
        {
          chainId: 1,
          validators: [generateValidatorChainData(validatorsAdditional.address, 6, 0)],
        },
        {
          chainId: 2,
          validators: [generateValidatorChainData(validatorsAdditional.address, 6, 256)],
        },
        {
          chainId: 255,
          validators: [generateValidatorChainData(validatorsAdditional.address, 6, 65535)],
        },
      ],
      removedValidators: [validatorsAddresses[0]],
    };

    expect(await validatorsSC.validatorsCount()).to.equal(5);
    expect(await validatorsSC.getValidatorsAddresses()).to.deep.equal(validatorsAddresses);

    const chainDataPrimeOld = await validatorsSC.getValidatorsChainData(1);
    const chainDataVectorOld = await validatorsSC.getValidatorsChainData(2);

    await validatorsSC.connect(contractSigner).submitNewValidatorSet(newValidatorSetDelta, chains);
    await validatorsSC.connect(contractSigner).validatorSetUpdated(chains);

    let chainDataPrime = await validatorsSC.getValidatorsChainData(1);
    let chainDataVector = await validatorsSC.getValidatorsChainData(2);

    expect(await validatorsSC.validatorsCount()).to.equal(5);
    expect(chainDataPrime.length).to.equal(5);
    expect(chainDataVector.length).to.equal(5);
    expect(await validatorsSC.getValidatorsAddresses()).to.deep.equal([
      validatorsAddresses[1],
      validatorsAddresses[2],
      validatorsAddresses[3],
      validatorsAddresses[4],
      validatorsAdditional.address,
    ]);

    for (let i = 0; i < chainDataPrime.length; i++) {
      const prime = chainDataPrime[i];
      const vector = chainDataVector[i];

      if (i != chainDataPrime.length - 1) {
        expect(prime.key).to.deep.equal(chainDataPrimeOld[i + 1].key);
        expect(vector.key).to.deep.equal(chainDataVectorOld[i + 1].key);
      } else {
        expect(prime.key).to.deep.equal(generateKey(6, 0));
        expect(vector.key).to.deep.equal(generateKey(6, 256));
      }
    }

    // now again delete last one, the one we previosly added
    await validatorsSC.connect(contractSigner).submitNewValidatorSet(
      {
        addedValidators: [],
        removedValidators: [validatorsAdditional.address],
      },
      chains
    );
    await validatorsSC.connect(contractSigner).validatorSetUpdated(chains);

    chainDataPrime = await validatorsSC.getValidatorsChainData(1);
    chainDataVector = await validatorsSC.getValidatorsChainData(2);

    expect(await validatorsSC.validatorsCount()).to.equal(4);
    expect(chainDataPrime.length).to.equal(4);
    expect(chainDataVector.length).to.equal(4);
    expect(await validatorsSC.getValidatorsAddresses()).to.deep.equal([
      validatorsAddresses[1],
      validatorsAddresses[2],
      validatorsAddresses[3],
      validatorsAddresses[4],
    ]);

    for (let i = 0; i < chainDataPrime.length; i++) {
      const prime = chainDataPrime[i];
      const vector = chainDataVector[i];

      expect(prime.key).to.deep.equal(chainDataPrimeOld[i + 1].key);
      expect(vector.key).to.deep.equal(chainDataVectorOld[i + 1].key);
    }
  });
});
