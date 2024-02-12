import { BridgeContract } from "./../typechain-types/BridgeContract";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Bridge Contract", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployBridgeContractFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, validator1, validator2, validator3, validator4, validator5] =
      await ethers.getSigners();
    const validators = [
      validator1,
      validator2,
      validator3,
      validator4,
      validator5,
    ];

    const BridgeContract = await ethers.getContractFactory("BridgeContract");
    const bridgeContract = await BridgeContract.deploy(validators);

    const UTXOs = {
      multisigOwnedUTXOs: [],
      feePayerOwnedUTXOs: [],
    };

    return { bridgeContract, owner, UTXOs, validators };
  }

  describe("Deployment", function () {
    it("Should set 5 validator", async function () {
      const { bridgeContract } = await loadFixture(deployBridgeContractFixture);
      const numberOfValidators = await bridgeContract.getValidatorsCount();

      expect(numberOfValidators).to.equal(5);
    });
  });

  describe("Registering new chain", function () {
    it("Should reject proposal if not sent by validator", async function () {
      const { bridgeContract, owner, UTXOs } = await loadFixture(
        deployBridgeContractFixture
      );

      await expect(
        bridgeContract
          .connect(owner)
          .registerChain("testChain", UTXOs, "0x", "0x")
      ).to.be.revertedWith("Not validator");
    });

    it("Should revert if same validator votes twice for the same chain", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(
        deployBridgeContractFixture
      );
      await bridgeContract
        .connect(validators[0])
        .registerChain("testChain", UTXOs, "0x", "0x");

      await expect(
        bridgeContract
          .connect(validators[0])
          .registerChain("testChain", UTXOs, "0x", "0x")
      ).to.be.revertedWith("Already proposed");
    });

    it("Should have correct number of votes for new chain", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(
        deployBridgeContractFixture
      );

      await bridgeContract
        .connect(validators[0])
        .registerChain("testChain", UTXOs, "0x", "0x");

      expect(await bridgeContract.getNumberOfVotes("testChain")).to.equal(1);

      await bridgeContract
        .connect(validators[1])
        .registerChain("testChain", UTXOs, "0x", "0x");

      expect(await bridgeContract.getNumberOfVotes("testChain")).to.equal(2);
    });

    it("Should emit new chain proposal", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(
        deployBridgeContractFixture
      );

      await expect(
        bridgeContract
          .connect(validators[0])
          .registerChain("testChain", UTXOs, "0x", "0x")
      )
        .to.emit(bridgeContract, "newChainProposal")
        .withArgs("testChain", validators[0].address);
    });

    it("Should add new chain if there are enough votes", async function () {
      const { bridgeContract, validators, UTXOs } = await loadFixture(
        deployBridgeContractFixture
      );

      await bridgeContract
        .connect(validators[0])
        .registerChain("testChain", UTXOs, "0x", "0x");
      await bridgeContract
        .connect(validators[1])
        .registerChain("testChain", UTXOs, "0x", "0x");
      await bridgeContract
        .connect(validators[2])
        .registerChain("testChain", UTXOs, "0x", "0x");

      expect(await bridgeContract.isChainRegistered("testChain")).to.be.false;

      await bridgeContract
        .connect(validators[3])
        .registerChain("testChain", UTXOs, "0x", "0x");

      expect(await bridgeContract.isChainRegistered("testChain")).to.be.true;
    });
  });

  it("Should emit new chain registered", async function () {
    const { bridgeContract, validators, UTXOs } = await loadFixture(
      deployBridgeContractFixture
    );

    await bridgeContract
      .connect(validators[0])
      .registerChain("testChain", UTXOs, "0x", "0x");

    await bridgeContract
      .connect(validators[1])
      .registerChain("testChain", UTXOs, "0x", "0x");

    await bridgeContract
      .connect(validators[2])
      .registerChain("testChain", UTXOs, "0x", "0x");

    await expect(
      bridgeContract
        .connect(validators[3])
        .registerChain("testChain", UTXOs, "0x", "0x")
    )
      .to.emit(bridgeContract, "newChainRegistered")
      .withArgs("testChain");
  });

  describe("Getting chains", function () {
    it("Should list all registered chains", async function () {
      const { bridgeContract, UTXOs, validators } = await loadFixture(
        deployBridgeContractFixture
      );

      await bridgeContract
        .connect(validators[0])
        .registerChain("testChain 1", UTXOs, "0x", "0x");
      await bridgeContract
        .connect(validators[1])
        .registerChain("testChain 1", UTXOs, "0x", "0x");
      await bridgeContract
        .connect(validators[2])
        .registerChain("testChain 1", UTXOs, "0x", "0x");
      await bridgeContract
        .connect(validators[3])
        .registerChain("testChain 1", UTXOs, "0x", "0x");

      await bridgeContract
        .connect(validators[0])
        .registerChain("testChain 2", UTXOs, "0x", "0x");
      await bridgeContract
        .connect(validators[1])
        .registerChain("testChain 2", UTXOs, "0x", "0x");
      await bridgeContract
        .connect(validators[2])
        .registerChain("testChain 2", UTXOs, "0x", "0x");
      await bridgeContract
        .connect(validators[3])
        .registerChain("testChain 2", UTXOs, "0x", "0x");

      const chains = await bridgeContract.getAllRegisteredChains();
      expect(chains.length).to.equal(2);
      expect(chains[0].id).to.equal("testChain 1");
      expect(chains[1].id).to.equal("testChain 2");
    });
  });
});

//   it("Should set the right owner", async function () {
//     const { lock, owner } = await loadFixture(deployOneYearLockFixture);

//     expect(await lock.owner()).to.equal(owner.address);
//   });

//   it("Should receive and store the funds to lock", async function () {
//     const { lock, lockedAmount } = await loadFixture(
//       deployOneYearLockFixture
//     );

//     expect(await ethers.provider.getBalance(lock.target)).to.equal(
//       lockedAmount
//     );

//   it("Should fail if the unlockTime is not in the future", async function () {
//     // We don't use the fixture here because we want a different deployment
//     const latestTime = await time.latest();
//     const Lock = await ethers.getContractFactory("Lock");
//     await expect(Lock.deploy(latestTime, { value: 1 })).to.be.revertedWith(
//       "Unlock time should be in the future"
//     );
//   });
// });

// describe("Withdrawals", function () {
//   describe("Validations", function () {
//     it("Should revert with the right error if called too soon", async function () {
//       const { lock } = await loadFixture(deployOneYearLockFixture);

//       await expect(lock.withdraw()).to.be.revertedWith(
//         "You can't withdraw yet"
//       );
//     });

//     it("Should revert with the right error if called from another account", async function () {
//       const { lock, unlockTime, otherAccount } = await loadFixture(
//         deployOneYearLockFixture
//       );

//       // We can increase the time in Hardhat Network
//       await time.increaseTo(unlockTime);

//       // We use lock.connect() to send a transaction from another account
//       await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
//         "You aren't the owner"
//       );
//     });

//     it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
//       const { lock, unlockTime } = await loadFixture(
//         deployOneYearLockFixture
//       );

//       // Transactions are sent using the first signer by default
//       await time.increaseTo(unlockTime);

//       await expect(lock.withdraw()).not.to.be.reverted;
//     });
//   });

//   describe("Events", function () {
//     it("Should emit an event on withdrawals", async function () {
//       const { lock, unlockTime, lockedAmount } = await loadFixture(
//         deployOneYearLockFixture
//       );

//       await time.increaseTo(unlockTime);

//       await expect(lock.withdraw())
//         .to.emit(lock, "Withdrawal")
//         .withArgs(lockedAmount, anyValue); // We accept any value as `when` arg
//     });
//   });

//   describe("Transfers", function () {
//     it("Should transfer the funds to the owner", async function () {
//       const { lock, unlockTime, lockedAmount, owner } = await loadFixture(
//         deployOneYearLockFixture
//       );

//       await time.increaseTo(unlockTime);

//       await expect(lock.withdraw()).to.changeEtherBalances(
//         [owner, lock],
//         [lockedAmount, -lockedAmount]
//       );
//     });
//   });
// });