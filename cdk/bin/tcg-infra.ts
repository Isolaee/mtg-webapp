#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TcgStack } from '../lib/tcg-stack';

const app = new cdk.App();

new TcgStack(app, 'TcgStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region:  process.env.CDK_DEFAULT_REGION,
  },
  description: 'TCG website — EC2 backend + CloudFront/S3 frontend',
});
