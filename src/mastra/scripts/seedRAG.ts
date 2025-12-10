import { initializeRAGCollections, breachIntelMemory, RAG_COLLECTIONS } from '../config/rag';

type SeedDoc = {
  id: string;
  collection: (typeof RAG_COLLECTIONS)[keyof typeof RAG_COLLECTIONS];
  content: string;
  metadata: Record<string, unknown>;
};

const seedData: SeedDoc[] = [
  {
    id: 'breach-equifax-2017',
    collection: RAG_COLLECTIONS.BREACH_REPORTS,
    content: `Equifax breach in 2017 exposed personal data of ~147 million people due to Apache Struts vulnerability (CVE-2017-5638). Attackers exploited a remote code execution bug via crafted Content-Type header. Dwell time exceeded 70 days before detection. Impact included SSNs, DOBs, addresses, driver's license numbers, and some credit card numbers.`,
    metadata: {
      identifier: 'Equifax-2017',
      type: 'breach',
      severity: 'Critical',
      dateIncident: '2017-03-07',
      dateDiscovered: '2017-07-29',
      tags: ['rce', 'apache struts', 'pii', 'data breach'],
      source: 'seed',
    },
  },
  {
    id: 'breach-solarwinds-2020',
    collection: RAG_COLLECTIONS.BREACH_REPORTS,
    content: `SolarWinds Orion supply chain attack (2020) involved trojanized updates (SUNBURST) distributed to ~18k customers. Attack attributed to APT29/Cozy Bear. Attackers gained access to source build environment, inserted backdoor communicating via DNS. Impacted US government agencies and large enterprises.`,
    metadata: {
      identifier: 'SolarWinds-2020',
      type: 'breach',
      severity: 'Critical',
      dateIncident: '2020-12-13',
      tags: ['supply chain', 'backdoor', 'apt29', 'sunburst'],
      source: 'seed',
    },
  },
  {
    id: 'cve-2021-44228',
    collection: RAG_COLLECTIONS.CVE_INTELLIGENCE,
    content: `Log4Shell (CVE-2021-44228) remote code execution in Apache Log4j 2.0-beta9 to 2.14.1 via JNDI lookup in message substitution. CVSS 10.0. Exploitable via user-controlled log data. Mitigations: upgrade to 2.17+, disable JNDI lookups, set -Dlog4j2.formatMsgNoLookups=true, remove JndiLookup class.`,
    metadata: {
      identifier: 'CVE-2021-44228',
      type: 'cve',
      severity: 'Critical',
      cvss: '10.0',
      cwe: 'CWE-502',
      tags: ['rce', 'log4j', 'jndi'],
      source: 'seed',
    },
  },
  {
    id: 'cve-2023-23397',
    collection: RAG_COLLECTIONS.CVE_INTELLIGENCE,
    content: `CVE-2023-23397 elevation of privilege in Microsoft Outlook. Attackers send crafted email with extended MAPI property triggering NTLM authentication to attacker-controlled server, enabling relay to gain privileges. No user interaction required. Patched March 2023. Detection via unusual NTLM traffic from Outlook process.`,
    metadata: {
      identifier: 'CVE-2023-23397',
      type: 'cve',
      severity: 'High',
      cvss: '9.8',
      tags: ['ntlm relay', 'outlook', 'eop'],
      source: 'seed',
    },
  },
  {
    id: 'threat-actor-apt29',
    collection: RAG_COLLECTIONS.THREAT_ACTORS,
    content: `APT29 (Cozy Bear) is a Russian state-sponsored threat actor linked to SVR. Known for stealthy intrusions, supply chain compromises (SolarWinds), and targeting government and tech sectors. TTPs include OAuth token theft, cloud persistence, living-off-the-land, and spearphishing with malware such as SUNBURST, Cosmic Gale.`,
    metadata: {
      identifier: 'APT29',
      type: 'threat-actor',
      motivation: 'espionage',
      tags: ['russia', 'apt', 'solarwinds'],
      source: 'seed',
    },
  },
  {
    id: 'mitre-attack-t1190',
    collection: RAG_COLLECTIONS.MITRE_ATTACK_TTPS,
    content: `MITRE ATT&CK T1190: Exploit Public-Facing Application. Adversaries exploit vulnerabilities in internet-facing systems to gain initial access. Examples include SQL injection, RCE in web frameworks, deserialization bugs. Mitigations: patching, WAF, input validation, least privilege, exploit detection via web logs.`,
    metadata: {
      identifier: 'T1190',
      type: 'mitre-attack-ttp',
      tactic: 'Initial Access',
      tags: ['exploit', 'public-facing', 'initial-access'],
      source: 'seed',
    },
  },
];

async function main() {
  console.log('Initializing RAG collections...');
  await initializeRAGCollections();

  console.log('Seeding RAG data...');
  for (const doc of seedData) {
    await breachIntelMemory.add({
      collection: doc.collection,
      documents: [
        {
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
        },
      ],
    });
    console.log(`Seeded ${doc.id} into ${doc.collection}`);
  }

  console.log('✅ Seeding complete');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seeding failed', err);
  process.exit(1);
});
