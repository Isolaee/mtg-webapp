import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

// ACM certificates used by CloudFront must be in us-east-1 regardless of where
// the rest of the stack lives. This separate stack handles that requirement.
// crossRegionReferences: true (set in bin/tcg-infra.ts) lets CDK pass the cert
// ARN across regions via SSM parameters automatically.
export class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.certificate = new acm.Certificate(this, 'SiteCert', {
      domainName: 'tcg-singularity.com',
      subjectAlternativeNames: ['www.tcg-singularity.com'],
      validation: acm.CertificateValidation.fromDns(),
    });

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      description: 'ACM certificate ARN (us-east-1) — used by CloudFront in TcgStack',
    });
  }
}
