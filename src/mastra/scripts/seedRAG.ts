import { initializeRAGCollections, breachIntelMemory, RAG_COLLECTIONS } from '../config/rag';

type SeedDoc = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
};

type SeedSet = {
  collection: (typeof RAG_COLLECTIONS)[keyof typeof RAG_COLLECTIONS];
  documents: SeedDoc[];
};

const now = new Date().toISOString();

const seeds: SeedSet[] = [
  {
    collection: RAG_COLLECTIONS.BREACH_REPORTS,
    documents: [
      {
        id: 'breach-equifax-2017',
        content: `Equifax breach (2017). Exploited Apache Struts CVE-2017-5638 via crafted Content-Type header to achieve unauthenticated RCE. Dwell time ~76 days. Data: ~147M consumers (SSNs, DOB, addresses, some credit cards). Root cause: missed patch, insufficient segmentation/detection. Mitigations: aggressive patching, WAF virtual patching, asset inventory, monitoring.`,
        metadata: {
          identifier: 'Equifax-2017',
          type: 'breach',
          severity: 'Critical',
          dateIncident: '2017-05-01',
          dateDisclosed: '2017-09-07',
          dateAdded: now,
          tags: ['apache-struts', 'cve-2017-5638', 'rce', 'data-breach'],
          source: 'seed',
        },
      },
      {
        id: 'breach-solarwinds-2020',
        content: `SolarWinds Orion supply chain compromise (2020). Attackers inserted SUNBURST backdoor into signed Orion updates. Impacted ~18k customers; high-profile US gov and enterprise targets. Techniques: supply-chain poisoning, code-signing abuse, staged C2, lateral movement. Mitigations: rebuild pipeline, certificate rotation, network segmentation, IOC sweeping.`,
        metadata: {
          identifier: 'SolarWinds-2020',
          type: 'breach',
          severity: 'Critical',
          dateIncident: '2020-12-13',
          dateAdded: now,
          tags: ['supply-chain', 'sunburst', 'apt29', 'code-signing'],
          source: 'seed',
        },
      },
    ],
  },
  {
    collection: RAG_COLLECTIONS.CVE_INTELLIGENCE,
    documents: [
      {
        id: 'cve-2021-44228',
        content: `Log4Shell (CVE-2021-44228). Apache Log4j2 JNDI lookup RCE across Java ecosystems. CVSS 10.0. Affected 2.0-beta9 to 2.14.1. Exploitation via attacker-controlled log data. Mitigations: upgrade to 2.17+, disable JNDI lookups, remove JndiLookup class, outbound egress controls, WAF virtual patching.`,
        metadata: {
          identifier: 'CVE-2021-44228',
          type: 'cve',
          severity: 'Critical',
          cvss: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H',
          cwe: 'CWE-502',
          datePublished: '2021-12-10',
          dateAdded: now,
          tags: ['log4j', 'jndi', 'rce'],
          source: 'seed',
        },
      },
      {
        id: 'cve-2023-23397',
        content: `CVE-2023-23397 (Outlook NTLM credential leak). Crafted Reminder Service message triggers NTLM auth to attacker host, enabling relay/lateral movement without user interaction. Exploited in the wild. Mitigations: apply March 2023 patch, block outbound SMB/445, enforce SMB signing, monitor anomalous calendar messages.`,
        metadata: {
          identifier: 'CVE-2023-23397',
          type: 'cve',
          severity: 'High',
          cvss: '9.8',
          datePublished: '2023-03-14',
          dateAdded: now,
          tags: ['outlook', 'ntlm', 'credential-theft', 'relay'],
          source: 'seed',
        },
      },
    ],
  },
  {
    collection: RAG_COLLECTIONS.THREAT_ACTORS,
    documents: [
      {
        id: 'threat-actor-apt29',
        content: `APT29 (Cozy Bear). Russian SVR-linked espionage group. TTPs: spearphishing, OAuth/token theft, supply-chain compromises (SolarWinds), stealthy cloud persistence, custom malware (SUNBURST, WellMess). Targets: government, tech, think tanks.`,
        metadata: {
          identifier: 'APT29',
          type: 'threat-actor',
          motivation: 'espionage',
          region: 'RU',
          dateAdded: now,
          tags: ['apt', 'supply-chain', 'cloud', 'espionage'],
          source: 'seed',
        },
      },
    ],
  },
  {
    collection: RAG_COLLECTIONS.MITRE_ATTACK_TTPS,
    documents: [
      {
        id: 'mitre-attack-t1190',
        content: `MITRE ATT&CK T1190: Exploit Public-Facing Application. Adversaries exploit vulnerabilities in internet-facing systems to gain initial access (e.g., CVE-2021-44228, CVE-2017-5638). Mitigations: patch management, WAF/virtual patching, input validation, segmentation, exploit detection in logs.`,
        metadata: {
          identifier: 'T1190',
          type: 'mitre-attack-ttp',
          tactic: 'Initial Access',
          dateAdded: now,
          tags: ['initial-access', 'public-facing', 'exploit'],
          source: 'seed',
        },
      },
    ],
  },
  {
    collection: RAG_COLLECTIONS.SECURITY_ADVISORIES,
    documents: [
      {
        id: 'advisory-cisa-log4shell-2021',
        content: `CISA advisory AA21-356A on Log4Shell urging immediate mitigation, patching guidance, detection, and IOCs related to exploitation.`,
        metadata: {
          identifier: 'AA21-356A',
          type: 'advisory',
          severity: 'Critical',
          datePublished: '2021-12-22',
          dateAdded: now,
          tags: ['cisa', 'log4shell', 'advisory'],
          source: 'seed',
        },
      },
    ],
  },
  {
    collection: RAG_COLLECTIONS.INDICATORS_OF_COMPROMISE,
    documents: [
      {
        id: 'ioc-sunburst',
        content: `SUNBURST IOCs: avsvmcloud.com C2 domain, delayed DNS beacons, signed Orion DLL with malicious update logic.`,
        metadata: {
          identifier: 'IOC-SUNBURST',
          type: 'ioc',
          severity: 'High',
          dateAdded: now,
          tags: ['sunburst', 'ioc', 'solarwinds'],
          source: 'seed',
        },
      },
    ],
  },
];

async function seed() {
  console.log('Initializing RAG collections...');
  await initializeRAGCollections();

  console.log(`Seeding ${seeds.length} collections...`);
  for (const seedSet of seeds) {
    try {
      console.log(`Seeding collection: ${seedSet.collection}`);
      await breachIntelMemory.add({
        collection: seedSet.collection,
        documents: seedSet.documents,
      });
      console.log(`✓ Seeded ${seedSet.documents.length} document(s) into ${seedSet.collection}`);
    } catch (err) {
      console.error(`Failed to seed ${seedSet.collection}:`, err);
    }
  }

  console.log('✅ RAG seed completed');
}

seed().catch((err) => {
  console.error('❌ RAG seed failed:', err);
  process.exit(1);
});
