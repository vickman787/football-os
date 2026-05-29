// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PredictionProof
/// @notice Stores Football OS prediction proofs on X Layer.
contract PredictionProof {
    struct Proof {
        uint256 id;
        address predictor;
        bytes32 matchId;
        bytes32 pickHash;
        uint16 confidenceBps;
        uint256 timestamp;
    }

    Proof[] private proofs;
    mapping(address => uint256[]) private proofIdsByUser;

    event PredictionPublished(
        uint256 indexed id,
        address indexed predictor,
        bytes32 indexed matchId,
        bytes32 pickHash,
        uint16 confidenceBps,
        uint256 timestamp
    );

    event ProofPublished(
        uint256 indexed id,
        address indexed predictor,
        bytes32 indexed matchId,
        bytes32 pickHash,
        uint16 confidenceBps
    );

    function publish(bytes32 matchId, bytes32 pickHash, uint16 confidenceBps)
        external
        returns (uint256 id)
    {
        require(confidenceBps <= 10_000, "confidence_too_high");

        id = proofs.length;
        uint256 timestamp = block.timestamp;

        proofs.push(Proof({
            id: id,
            predictor: msg.sender,
            matchId: matchId,
            pickHash: pickHash,
            confidenceBps: confidenceBps,
            timestamp: timestamp
        }));

        proofIdsByUser[msg.sender].push(id);

        emit PredictionPublished(
            id,
            msg.sender,
            matchId,
            pickHash,
            confidenceBps,
            timestamp
        );
        emit ProofPublished(id, msg.sender, matchId, pickHash, confidenceBps);
    }

    function getProof(uint256 id) external view returns (Proof memory) {
        require(id < proofs.length, "proof_not_found");
        return proofs[id];
    }

    function getProofCount() external view returns (uint256) {
        return proofs.length;
    }

    function getProofsByUser(address user) external view returns (uint256[] memory) {
        return proofIdsByUser[user];
    }
}
