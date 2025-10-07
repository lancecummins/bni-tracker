import { NextRequest, NextResponse } from 'next/server';
import { seedDatabase, clearDatabase } from '@/lib/mockData/seeder';

export async function POST(request: NextRequest) {
  try {
    // Check for a secret key to prevent unauthorized seeding
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (secret !== 'development-seed-key') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get parameters from request body
    const body = await request.json().catch(() => ({}));
    const {
      userCount = 20,
      teamCount = 4,
      weeksToGenerate = 3,
      clearFirst = true,
    } = body;

    console.log('Starting database seed via API...');

    const result = await seedDatabase(
      userCount,
      teamCount,
      weeksToGenerate,
      clearFirst
    );

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      summary: result,
    });
  } catch (error) {
    console.error('Seed API error:', error);
    return NextResponse.json(
      { error: 'Failed to seed database', details: error },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check for a secret key to prevent unauthorized clearing
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (secret !== 'development-seed-key') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Clearing database via API...');

    await clearDatabase();

    return NextResponse.json({
      success: true,
      message: 'Database cleared successfully',
    });
  } catch (error) {
    console.error('Clear API error:', error);
    return NextResponse.json(
      { error: 'Failed to clear database', details: error },
      { status: 500 }
    );
  }
}