import { NextRequest, NextResponse } from 'next/server';
import { cloneRepositoryWithStructuredPath } from '@/lib/file-system';

interface CloneRequest {
  repositoryId: string;
  orgId: string;
  memberPhoneNumber: string;
  branch?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CloneRequest = await request.json();
    const { repositoryId, orgId, memberPhoneNumber, branch } = body;

    if (!repositoryId || !orgId || !memberPhoneNumber) {
      return NextResponse.json(
        { error: 'Missing required parameters: repositoryId, orgId, memberPhoneNumber' },
        { status: 400 }
      );
    }

    console.log(`🚀 Starting clone process for repository: ${repositoryId}, org: ${orgId}, member phone: ${memberPhoneNumber}`);

    // Clone repository using the structured path
    const cloneResult = await cloneRepositoryWithStructuredPath(
      repositoryId,
      orgId,
      memberPhoneNumber,
      branch,
      true // Shallow clone
    );

    if (!cloneResult.success) {
      return NextResponse.json(
        { error: cloneResult.error || 'Failed to clone repository' },
        { status: 500 }
      );
    }

    console.log(`✅ Repository cloned successfully to: ${cloneResult.repositoryPath}`);

    // Return success with the relative path for claude-code API
    const relativeProjectPath = `${orgId}/${memberPhoneNumber}/${cloneResult.repositoryInfo?.name}`;

    return NextResponse.json({
      success: true,
      repositoryPath: cloneResult.repositoryPath,
      relativeProjectPath,
      repositoryInfo: cloneResult.repositoryInfo
    });

  } catch (error) {
    console.error('❌ Error in clone repository API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
} 