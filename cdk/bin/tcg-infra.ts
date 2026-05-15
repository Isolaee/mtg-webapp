#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TcgStack } from '../lib/tcg-stack';
import { CertificateStack } from '../lib/certificate-stack';

const app = new cdk.App();

const certStack = new CertificateStack(app, 'TcgCertStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  crossRegionReferences: true,
  description: 'ACM TLS certificate for tcg-singularity.com (must be us-east-1 for CloudFront)',
});

new TcgStack(app, 'TcgStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  certificate: certStack.certificate,
  crossRegionReferences: true,
  description: 'TCG website — EC2 backend + CloudFront/S3 frontend',
});
