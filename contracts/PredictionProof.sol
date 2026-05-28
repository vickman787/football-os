// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PredictionProof
/// @notice Anchors Football OS predictions onto X Layer (zkEVM, EVM-compatible).
/// @dev Each prediction is stored as an immutable hash + metadata, indexed per predictor.
///      The hash is computed off-chain over (matchId, pick, confidence, salt) and committed here.
contract PredictionProof {
    struct Proof {
        address predictor;
        bytes32 matchId;
        bytes32 pickHash;
        uint16  confidenceBps; // 0-10000
        uint64  publishedAt;
        bool    settled;
        bool    won;
    }

    Proof[] public proofs;
    mapping(address => uint256[]) public proofsByPredictor;
    address public owner;

    event ProofPublished(
        uint256 indexed id,
        address indexed predictor,
        bytes32 indexed matchId,
        bytes32 pickHash,
        uint16  confidenceBps
    );

    event ProofSettled(uint256 indexed id, bool won);

    modifier onlyOwner() {
        require(msg.sender == owner, "not_owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Publish a prediction proof. Anyone may publish their own predictions.
    function publish(bytes32 matchId, bytes32 pickHash, uint16 confidenceBps)
        external
        returns (uint256 id)
    {
        require(confidenceBps <= 10_000, "bad_conf");
        require(matchId != bytes32(0) && pickHash != bytes32(0), "empty");

        id = proofs.length;
        proofs.push(Proof({
            predictor: msg.sender,
            matchId: matchId,
            pickHash: pickHash,
            confidenceBps: confidenceBps,
            publishedAt: uint64(block.timestamp),
            settled: false,
            won: false
        }));
        proofsByPredictor[msg.sender].push(id);

        emit ProofPublished(id, msg.sender, matchId, pickHash, confidenceBps);
    }

    /// @notice Settle a prediction. In MVP this is gated to the owner (oracle).
    /// @dev Production version should use a decentralised oracle / signed result.
    function settle(uint256 id, bool won) external onlyOwner {
        require(id < proofs.length, "bad_id");
        Proof storage p = proofs[id];
        require(!p.settled, "settled");
        p.settled = true;
        p.won = won;
        emit ProofSettled(id, won);
    }

    function totalProofs() external view returns (uint256) {
        return proofs.length;
    }

    function proofIdsOf(address predictor) external view returns (uint256[] memory) {
        return proofsByPredictor[predictor];
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        owner = newOwner;
    }
}
