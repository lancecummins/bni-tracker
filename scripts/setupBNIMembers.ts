import { db } from '@/lib/firebase/config';
import { collection, getDocs, doc, deleteDoc, setDoc, Timestamp } from 'firebase/firestore';
import { User, UserRole } from '@/lib/types';

// BNI Member data
const bniMembers = [
  {
    firstName: 'Alexander',
    lastName: 'Jenkins',
    company: 'Universal Roofing & Construction',
    category: 'Roofing & Gutters',
    role: 'Secretary Treasurer'
  },
  {
    firstName: 'Andrew',
    lastName: 'Smalley',
    company: 'Law Office of Andrew Smalley',
    category: 'Family Law',
    role: 'Membership Committee'
  },
  {
    firstName: 'Asher',
    lastName: 'Hoopes',
    company: 'MassMutual',
    category: 'Finance & Insurance (Other)',
    role: null
  },
  {
    firstName: 'Ashley',
    lastName: 'Haynes',
    company: 'All Outdoors and Turf Boss',
    category: 'Lawn Care',
    role: null
  },
  {
    firstName: 'Craig',
    lastName: 'Hill',
    company: 'Sanders Heating and Cooling',
    category: 'HVAC - Heating & Air',
    role: 'Visitor Host'
  },
  {
    firstName: 'Cristina',
    lastName: 'Gross',
    company: 'Ceemi Agency',
    category: 'Web Design',
    role: null
  },
  {
    firstName: 'Dennis',
    lastName: 'Latham',
    company: 'Pinnacle Asset Management',
    category: 'Financial Advisor',
    role: null
  },
  {
    firstName: 'E. Gail',
    lastName: 'Everett',
    company: 'Systematic Tutoring Resulting in Development',
    category: 'Education Services/Tutor',
    role: null
  },
  {
    firstName: 'Geoff',
    lastName: 'Petis',
    company: 'That 1 Painter Upstate South Carolina',
    category: 'Painter & Decorator',
    role: null
  },
  {
    firstName: 'Jeffrey',
    lastName: 'McCann',
    company: 'Superior Plumbing Services LLC',
    category: 'Plumbing',
    role: null
  },
  {
    firstName: 'Justin',
    lastName: 'Griffin',
    company: 'Greenville Network Spinal Care',
    category: 'Chiropractor',
    role: 'Membership Committee'
  },
  {
    firstName: 'Lance',
    lastName: 'Cummins',
    company: 'VooHQ',
    category: 'Advertising & Marketing (Other)',
    role: 'President'
  },
  {
    firstName: 'Lindsey',
    lastName: 'Johnson',
    company: 'Carolina Closet',
    category: 'Construction (Other)',
    role: 'Visitor Host'
  },
  {
    firstName: 'Mandy',
    lastName: 'Caudill',
    company: 'Handy Mandy',
    category: 'Handyman',
    role: 'Education Coordinator'
  },
  {
    firstName: 'Michelle',
    lastName: 'Gray',
    company: 'Coldwell Banker Caine',
    category: 'Residential Real Estate Agent',
    role: 'Mentoring Coordinator'
  },
  {
    firstName: 'Scarlet',
    lastName: 'Vale',
    company: 'FutureTech IT Services',
    category: 'IT & Networks',
    role: null
  },
  {
    firstName: 'Scott',
    lastName: 'Jones',
    company: 'NAIEF',
    category: 'Commercial Real Estate',
    role: null
  },
  {
    firstName: 'Stosh',
    lastName: 'Fernandez',
    company: 'Voda Cleaning and Restoration of Greenville',
    category: 'Commercial Cleaning',
    role: null
  },
  {
    firstName: 'Tinus',
    lastName: 'Van Wyk',
    company: 'Superstein PA',
    category: 'Certified Public Accountant (CPA)',
    role: 'Vice President'
  }
];

async function setupBNIMembers() {
  console.log('Starting BNI member setup...');

  try {
    // Step 1: Delete all existing users
    console.log('\n1. Deleting existing users...');
    const usersCollection = collection(db, 'users');
    const usersSnapshot = await getDocs(usersCollection);

    const deletePromises = usersSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    console.log(`Deleted ${usersSnapshot.size} existing users.`);

    // Step 2: Create new users
    console.log('\n2. Creating BNI members...');

    for (const member of bniMembers) {
      const email = `lance+${member.firstName.toLowerCase().replace(/[^a-z]/g, '')}${member.lastName.toLowerCase().replace(/[^a-z]/g, '')}@lancecummins.com`;

      // Determine user role based on their BNI role
      let userRole: UserRole = 'member';
      if (member.role === 'President') {
        userRole = 'admin';
      } else if (member.role === 'Vice President' || member.role === 'Secretary Treasurer') {
        userRole = 'team-leader';
      }

      const newUser: User = {
        firstName: member.firstName,
        lastName: member.lastName,
        email: email,
        role: userRole,
        isActive: true,
        createdAt: Timestamp.now(),
        // You can add custom avatar URLs here if you have photos
        avatarUrl: undefined, // Will use auto-generated avatar
        teamId: null, // Will be assigned to teams later
      };

      // Create user with a deterministic ID based on email
      const userId = email.replace('@', '_at_').replace(/\./g, '_');
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, newUser);

      console.log(`Created user: ${member.firstName} ${member.lastName} (${email}) - Role: ${userRole}`);
    }

    console.log('\n✅ Successfully created all BNI members!');
    console.log(`Total members created: ${bniMembers.length}`);
    console.log('\nUser roles assigned:');
    console.log('- Lance Cummins: Admin (President)');
    console.log('- Tinus Van Wyk: Team Leader (Vice President)');
    console.log('- Alexander Jenkins: Team Leader (Secretary Treasurer)');
    console.log('- All others: Members');

  } catch (error) {
    console.error('Error setting up BNI members:', error);
  }
}

// Run the setup
setupBNIMembers();