#!/bin/bash

# Deploy Chaincode Script for Secure File Sharing with Wallet Addresses

set -e

echo "🚀 Starting chaincode deployment..."

# Set environment variables
export CORE_PEER_TLS_ENABLED=false
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=peer0.org1.example.com:7051

CHANNEL_NAME="filetransfer-channel"
CHAINCODE_NAME="secure-file-sharing"
CHAINCODE_VERSION="2.0"
CHAINCODE_PATH="/opt/gopath/src/github.com/chaincode/secure-file-sharing"

echo "📦 Packaging chaincode..."
docker exec cli peer lifecycle chaincode package ${CHAINCODE_NAME}.tar.gz \
    --path ${CHAINCODE_PATH} \
    --lang node \
    --label ${CHAINCODE_NAME}_${CHAINCODE_VERSION}

echo "📥 Installing chaincode on peer..."
docker exec cli peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz

echo "🔍 Querying installed chaincodes..."
docker exec cli peer lifecycle chaincode queryinstalled

# Get package ID
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled | grep ${CHAINCODE_NAME}_${CHAINCODE_VERSION} | cut -d' ' -f3 | cut -d',' -f1)
echo "📋 Package ID: $PACKAGE_ID"

echo "✅ Approving chaincode for Org1..."
docker exec cli peer lifecycle chaincode approveformyorg \
    -o orderer.example.com:7050 \
    --channelID $CHANNEL_NAME \
    --name $CHAINCODE_NAME \
    --version $CHAINCODE_VERSION \
    --package-id $PACKAGE_ID \
    --sequence 2

echo "🔍 Checking commit readiness..."
docker exec cli peer lifecycle chaincode checkcommitreadiness \
    --channelID $CHANNEL_NAME \
    --name $CHAINCODE_NAME \
    --version $CHAINCODE_VERSION \
    --sequence 2 \
    --output json

echo "🚀 Committing chaincode..."
docker exec cli peer lifecycle chaincode commit \
    -o orderer.example.com:7050 \
    --channelID $CHANNEL_NAME \
    --name $CHAINCODE_NAME \
    --version $CHAINCODE_VERSION \
    --sequence 2 \
    --peerAddresses peer0.org1.example.com:7051

echo "🔍 Querying committed chaincodes..."
docker exec cli peer lifecycle chaincode querycommitted --channelID $CHANNEL_NAME

echo "🎉 Chaincode deployment completed successfully!"
echo "📋 Channel: $CHANNEL_NAME"
echo "📦 Chaincode: $CHAINCODE_NAME"
echo "🏷️ Version: $CHAINCODE_VERSION"
echo "🆔 Package ID: $PACKAGE_ID"