@echo off
echo Creating mychannel...

REM Copy configtx.yaml and crypto to CLI container
docker cp configtx.yaml cli:/tmp/configtx.yaml
docker cp crypto-config cli:/tmp/

REM Generate channel transaction
docker exec -e FABRIC_CFG_PATH=/tmp cli configtxgen -profile ChannelConfig -outputCreateChannelTx /tmp/mychannel.tx -channelID mychannel

REM Create channel
docker exec cli peer channel create -o orderer.example.com:7050 -c mychannel -f /tmp/mychannel.tx --outputBlock /tmp/mychannel.block

REM Join channel
docker exec cli peer channel join -b /tmp/mychannel.block

echo Channel created and joined successfully!
