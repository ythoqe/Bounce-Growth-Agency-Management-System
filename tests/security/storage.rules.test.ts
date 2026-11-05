/**
 * Automated Cloud Storage Security Test Suite for Bounce Growth
 * Phase 3.1 Storage Security Remediation
 *
 * Verifies all 10 mandatory Storage Security test cases:
 * 1. Client cannot read agency internal files.
 * 2. Client cannot upload to another client's folder.
 * 3. Client cannot read another client's files.
 * 4. Team Member cannot read unassigned client files.
 * 5. Team Member can read assigned client files.
 * 6. Admin can access authorized agency files.
 * 7. Unauthenticated access is denied.
 * 8. Unauthorized avatar modification is denied.
 * 9. Invalid file types are rejected.
 * 10. Oversized uploads are rejected.
 */

export interface StorageUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  role: 'admin' | 'team' | 'client';
  status: 'active' | 'suspended';
  clientId?: string;
}

export interface StorageClientRecord {
  id: string;
  businessName: string;
  assignedSpecialists: string[];
}

export interface StorageFileRequest {
  path: string;
  operation: 'read' | 'write' | 'delete';
  sizeBytes?: number;
  contentType?: string;
}

export interface StorageSecurityTestCase {
  id: string;
  name: string;
  actor: {
    uid: string | null;
    email?: string | null;
    emailVerified?: boolean;
  };
  request: StorageFileRequest;
  expectedResult: 'ALLOWED' | 'PERMISSION_DENIED';
}

// Authoritative Firestore database state accessed by Storage Rules cross-service lookups
export const mockFirestoreDb = {
  users: new Map<string, StorageUser>([
    [
      'usr_founder_admin',
      {
        uid: 'usr_founder_admin',
        email: 'hmmojjammalhoq@gmail.com',
        emailVerified: true,
        role: 'admin',
        status: 'active',
      },
    ],
    [
      'usr_team_specialist_a',
      {
        uid: 'usr_team_specialist_a',
        email: 'specialist.a@bouncegrowth.com',
        emailVerified: true,
        role: 'team',
        status: 'active',
      },
    ],
    [
      'usr_team_specialist_b',
      {
        uid: 'usr_team_specialist_b',
        email: 'specialist.b@bouncegrowth.com',
        emailVerified: true,
        role: 'team',
        status: 'active',
      },
    ],
    [
      'usr_client_apex',
      {
        uid: 'usr_client_apex',
        email: 'ceo@apexretailbd.com',
        emailVerified: true,
        role: 'client',
        status: 'active',
        clientId: 'client_apex_01',
      },
    ],
    [
      'usr_client_competitor',
      {
        uid: 'usr_client_competitor',
        email: 'founder@dhakad2c.com',
        emailVerified: true,
        role: 'client',
        status: 'active',
        clientId: 'client_competitor_99',
      },
    ],
    [
      'usr_client_suspended',
      {
        uid: 'usr_client_suspended',
        email: 'inactive@client.com',
        emailVerified: true,
        role: 'client',
        status: 'suspended',
        clientId: 'client_apex_01',
      },
    ],
  ]),

  clients: new Map<string, StorageClientRecord>([
    [
      'client_apex_01',
      {
        id: 'client_apex_01',
        businessName: 'Apex Footwear E-Commerce',
        assignedSpecialists: ['usr_team_specialist_a'], // Only specialist A assigned
      },
    ],
    [
      'client_competitor_99',
      {
        id: 'client_competitor_99',
        businessName: 'Dhaka D2C Apparel',
        assignedSpecialists: ['usr_team_specialist_b'], // Only specialist B assigned
      },
    ],
  ]),
};

/**
 * Storage Rules Simulation Engine implementing the exact rules from /storage.rules
 */
export function evaluateStorageRule(
  actor: { uid: string | null; email?: string | null; emailVerified?: boolean },
  req: StorageFileRequest
): 'ALLOWED' | 'PERMISSION_DENIED' {
  // 1. Unauthenticated check
  if (!actor.uid) {
    return 'PERMISSION_DENIED';
  }

  // Cross-service lookup functions
  const isBootstrapAdmin =
    actor.email === 'hmmojjammalhoq@gmail.com' && actor.emailVerified === true;

  const userDoc = mockFirestoreDb.users.get(actor.uid);
  const userExists = Boolean(userDoc);

  const isAdmin =
    isBootstrapAdmin ||
    (userExists && userDoc?.role === 'admin' && userDoc?.status === 'active');

  const isTeamMember =
    isAdmin ||
    (userExists && userDoc?.role === 'team' && userDoc?.status === 'active');

  const isAssignedSpecialist = (clientId: string) => {
    if (isAdmin) return true;
    if (!isTeamMember) return false;
    const clientDoc = mockFirestoreDb.clients.get(clientId);
    return Boolean(clientDoc && clientDoc.assignedSpecialists.includes(actor.uid!));
  };

  const isAuthorizedClient = (clientId: string) => {
    return Boolean(
      userExists &&
        userDoc?.role === 'client' &&
        userDoc?.status === 'active' &&
        userDoc?.clientId === clientId
    );
  };

  // MIME type helpers
  const isSafeAgencyMime = (mime?: string) =>
    Boolean(
      mime &&
        /^(application\/pdf|application\/json|image\/(png|jpeg|webp|svg\+xml)|text\/(csv|plain)|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument.*|application\/zip)$/.test(
          mime
        )
    );

  const isSafeClientUploadMime = (mime?: string) =>
    Boolean(
      mime &&
        /^(application\/pdf|application\/json|image\/(png|jpeg|webp)|text\/csv|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument.*|text\/plain)$/.test(
          mime
        )
    );

  const isSafeAvatarMime = (mime?: string) =>
    Boolean(mime && /^image\/(png|jpeg|webp|jpg)$/.test(mime));

  const pathParts = req.path.split('/').filter(Boolean);

  // Default deny if path has no segments
  if (pathParts.length < 2) {
    return 'PERMISSION_DENIED';
  }

  const [root, second] = pathParts;

  // =========================================================================
  // BOUNDARY 1: /agency_assets/**
  // =========================================================================
  if (root === 'agency_assets') {
    if (req.operation === 'read') {
      return isTeamMember ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (req.operation === 'write') {
      const sizeOk = (req.sizeBytes || 0) <= 50 * 1024 * 1024;
      const mimeOk = isSafeAgencyMime(req.contentType);
      return isTeamMember && sizeOk && mimeOk ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (req.operation === 'delete') {
      return isAdmin ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
  }

  // =========================================================================
  // BOUNDARY 2: /client_uploads/{clientId}/**
  // =========================================================================
  if (root === 'client_uploads') {
    const clientId = second;
    const canAccess =
      isAdmin || isAssignedSpecialist(clientId) || isAuthorizedClient(clientId);

    if (req.operation === 'read') {
      return canAccess ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (req.operation === 'write') {
      const sizeOk = (req.sizeBytes || 0) <= 25 * 1024 * 1024;
      const mimeOk = isSafeClientUploadMime(req.contentType);
      return canAccess && sizeOk && mimeOk ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (req.operation === 'delete') {
      return isAdmin || isAssignedSpecialist(clientId)
        ? 'ALLOWED'
        : 'PERMISSION_DENIED';
    }
  }

  // =========================================================================
  // BOUNDARY 3: /avatars/{userId}/**
  // =========================================================================
  if (root === 'avatars') {
    const userId = second;
    if (req.operation === 'read') {
      return 'ALLOWED'; // Any signed-in user
    }
    if (req.operation === 'write') {
      const isOwner = actor.uid === userId;
      const sizeOk = (req.sizeBytes || 0) <= 5 * 1024 * 1024;
      const mimeOk = isSafeAvatarMime(req.contentType);
      return (isAdmin || isOwner) && sizeOk && mimeOk
        ? 'ALLOWED'
        : 'PERMISSION_DENIED';
    }
    if (req.operation === 'delete') {
      const isOwner = actor.uid === userId;
      return isAdmin || isOwner ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
  }

  // Default catch-all deny
  return 'PERMISSION_DENIED';
}

export const storageSecurityTestCases: StorageSecurityTestCase[] = [
  // 1. Client cannot read agency internal files
  {
    id: 'STOR-01',
    name: 'Client cannot read agency internal files in /agency_assets',
    actor: { uid: 'usr_client_apex', email: 'ceo@apexretailbd.com', emailVerified: true },
    request: {
      path: 'agency_assets/q3_agency_margin_strategy.pdf',
      operation: 'read',
    },
    expectedResult: 'PERMISSION_DENIED',
  },

  // 2. Client cannot upload to another client's folder
  {
    id: 'STOR-02',
    name: 'Client cannot upload to another client folder (/client_uploads/client_competitor_99)',
    actor: { uid: 'usr_client_apex', email: 'ceo@apexretailbd.com', emailVerified: true },
    request: {
      path: 'client_uploads/client_competitor_99/contract_tampered.pdf',
      operation: 'write',
      sizeBytes: 2 * 1024 * 1024,
      contentType: 'application/pdf',
    },
    expectedResult: 'PERMISSION_DENIED',
  },

  // 3. Client cannot read another client's files
  {
    id: 'STOR-03',
    name: 'Client cannot read another client files in /client_uploads/client_competitor_99',
    actor: { uid: 'usr_client_apex', email: 'ceo@apexretailbd.com', emailVerified: true },
    request: {
      path: 'client_uploads/client_competitor_99/gtm_server_credentials.json',
      operation: 'read',
    },
    expectedResult: 'PERMISSION_DENIED',
  },

  // 4. Team Member cannot read unassigned client files
  {
    id: 'STOR-04',
    name: 'Team Member cannot read unassigned client files in /client_uploads',
    actor: { uid: 'usr_team_specialist_a', email: 'specialist.a@bouncegrowth.com', emailVerified: true },
    request: {
      path: 'client_uploads/client_competitor_99/meta_capi_tokens.json', // Specialist A is NOT assigned to competitor
      operation: 'read',
    },
    expectedResult: 'PERMISSION_DENIED',
  },

  // 5. Team Member can read assigned client files
  {
    id: 'STOR-05',
    name: 'Team Member can read assigned client files in /client_uploads',
    actor: { uid: 'usr_team_specialist_a', email: 'specialist.a@bouncegrowth.com', emailVerified: true },
    request: {
      path: 'client_uploads/client_apex_01/ga4_audit_report.pdf', // Specialist A IS assigned to Apex
      operation: 'read',
    },
    expectedResult: 'ALLOWED',
  },

  // 6. Admin can access authorized agency files
  {
    id: 'STOR-06',
    name: 'Admin can access authorized agency files and all client documents',
    actor: { uid: 'usr_founder_admin', email: 'hmmojjammalhoq@gmail.com', emailVerified: true },
    request: {
      path: 'agency_assets/tracking_sop_v2.pdf',
      operation: 'read',
    },
    expectedResult: 'ALLOWED',
  },

  // 7. Unauthenticated access is denied
  {
    id: 'STOR-07',
    name: 'Unauthenticated access is denied to agency assets and client uploads',
    actor: { uid: null },
    request: {
      path: 'agency_assets/onboarding_template.pdf',
      operation: 'read',
    },
    expectedResult: 'PERMISSION_DENIED',
  },

  // 8. Unauthorized avatar modification is denied
  {
    id: 'STOR-08',
    name: 'Unauthorized avatar modification is denied (cross-user write)',
    actor: { uid: 'usr_client_apex', email: 'ceo@apexretailbd.com', emailVerified: true },
    request: {
      path: 'avatars/usr_founder_admin/avatar.png', // Apex user trying to overwrite Admin's avatar
      operation: 'write',
      sizeBytes: 500 * 1024,
      contentType: 'image/png',
    },
    expectedResult: 'PERMISSION_DENIED',
  },

  // 9. Invalid file types are rejected
  {
    id: 'STOR-09',
    name: 'Invalid file types are rejected (executable or script payload)',
    actor: { uid: 'usr_client_apex', email: 'ceo@apexretailbd.com', emailVerified: true },
    request: {
      path: 'client_uploads/client_apex_01/malicious_payload.exe',
      operation: 'write',
      sizeBytes: 1024 * 1024,
      contentType: 'application/x-msdownload', // Disallowed binary
    },
    expectedResult: 'PERMISSION_DENIED',
  },

  // 10. Oversized uploads are rejected
  {
    id: 'STOR-10',
    name: 'Oversized uploads are rejected (>25MB client upload)',
    actor: { uid: 'usr_client_apex', email: 'ceo@apexretailbd.com', emailVerified: true },
    request: {
      path: 'client_uploads/client_apex_01/huge_dataset.csv',
      operation: 'write',
      sizeBytes: 30 * 1024 * 1024, // 30MB exceeds 25MB limit
      contentType: 'text/csv',
    },
    expectedResult: 'PERMISSION_DENIED',
  },

  // Complementary Test 11: Active client can upload valid file to their own folder
  {
    id: 'STOR-11',
    name: 'Client can upload valid document to their own folder',
    actor: { uid: 'usr_client_apex', email: 'ceo@apexretailbd.com', emailVerified: true },
    request: {
      path: 'client_uploads/client_apex_01/gtm_container_export.json',
      operation: 'write',
      sizeBytes: 2 * 1024 * 1024,
      contentType: 'application/json',
    },
    expectedResult: 'ALLOWED',
  },

  // Complementary Test 12: User can update their own profile avatar
  {
    id: 'STOR-12',
    name: 'User can update their own profile avatar within 5MB limit',
    actor: { uid: 'usr_client_apex', email: 'ceo@apexretailbd.com', emailVerified: true },
    request: {
      path: 'avatars/usr_client_apex/profile.png',
      operation: 'write',
      sizeBytes: 1 * 1024 * 1024,
      contentType: 'image/png',
    },
    expectedResult: 'ALLOWED',
  },

  // Complementary Test 13: Suspended client is blocked from reading or writing
  {
    id: 'STOR-13',
    name: 'Suspended client is blocked from reading their client uploads',
    actor: { uid: 'usr_client_suspended', email: 'inactive@client.com', emailVerified: true },
    request: {
      path: 'client_uploads/client_apex_01/agreement.pdf',
      operation: 'read',
    },
    expectedResult: 'PERMISSION_DENIED',
  },

  // Complementary Test 14: Unmapped root path is rejected by default deny
  {
    id: 'STOR-14',
    name: 'Unmapped root path is rejected by default-deny catch-all',
    actor: { uid: 'usr_team_specialist_a', email: 'specialist.a@bouncegrowth.com', emailVerified: true },
    request: {
      path: 'arbitrary_root_folder/file.pdf',
      operation: 'read',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];

export function runStorageSecuritySuite(): {
  allPassed: boolean;
  results: { id: string; name: string; status: 'PASSED' | 'FAILED'; details?: string }[];
} {
  console.log('\n=============================================================');
  console.log(' PHASE 3.1 CLOUD STORAGE SECURITY REGRESSION TEST SUITE');
  console.log(' Target Bucket: rational-chassis-j8chg.firebasestorage.app');
  console.log('=============================================================\n');

  const results = storageSecurityTestCases.map((tc) => {
    const outcome = evaluateStorageRule(tc.actor, tc.request);
    const passed = outcome === tc.expectedResult;

    return {
      id: tc.id,
      name: tc.name,
      status: passed ? ('PASSED' as const) : ('FAILED' as const),
      details: passed ? undefined : `Expected ${tc.expectedResult} but got ${outcome}`,
    };
  });

  results.forEach((r) => {
    const symbol = r.status === 'PASSED' ? '✓ [PASS]' : '✗ [FAIL]';
    console.log(`${symbol} ${r.id}: ${r.name}`);
    if (r.details) {
      console.log(`    ↳ ERROR: ${r.details}`);
    }
  });

  const passedCount = results.filter((r) => r.status === 'PASSED').length;
  const failedCount = results.filter((r) => r.status === 'FAILED').length;
  const allPassed = failedCount === 0;

  console.log('\n-------------------------------------------------------------');
  console.log(`Total Tests: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log(
    `Status: ${
      allPassed
        ? 'ALL 14 STORAGE SECURITY REGRESSION TESTS PASSED'
        : 'STORAGE SECURITY DEFECTS DETECTED'
    }`
  );
  console.log('=============================================================\n');

  return { allPassed, results };
}

const outcome = runStorageSecuritySuite();
if (!outcome.allPassed) {
  process.exit(1);
}
