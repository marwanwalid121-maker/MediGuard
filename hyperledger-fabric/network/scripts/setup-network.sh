#!/bin/bash

# Generate crypto materials using fabric-ca-client
echo "Generating crypto materials..."

# Wait for CA to be ready
sleep 5

# Enroll CA admin
export FABRIC_CA_CLIENT_HOME=/tmp/ca-admin
fabric-ca-client enroll -u http://admin:adminpw@ca.org1.example.com:7054

# Register and enroll orderer
fabric-ca-client register --id.name orderer --id.secret ordererpw --id.type orderer -u http://admin:adminpw@ca.org1.example.com:7054
fabric-ca-client enroll -u http://orderer:ordererpw@ca.org1.example.com:7054 -M /tmp/orderer/msp

# Register and enroll peer
fabric-ca-client register --id.name peer0 --id.secret peer0pw --id.type peer -u http://admin:adminpw@ca.org1.example.com:7054
fabric-ca-client enroll -u http://peer0:peer0pw@ca.org1.example.com:7054 -M /tmp/peer0/msp

# Register and enroll admin user
fabric-ca-client register --id.name admin --id.secret adminpw --id.type admin -u http://admin:adminpw@ca.org1.example.com:7054
fabric-ca-client enroll -u http://admin:adminpw@ca.org1.example.com:7054 -M /tmp/admin/msp

echo "Crypto materials generated successfully"