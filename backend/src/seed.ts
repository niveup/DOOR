import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const subjectsData = [
  {
    subjectId: 1,
    subjectName: "Engineering Mathematics",
    importanceLevel: 0.14,
    topics: [
      "Linear Algebra",
      "Calculus",
      "Differential Equations",
      "Complex Variables",
      "Probability and Statistics",
      "Numerical Methods"
    ]
  },
  {
    subjectId: 2,
    subjectName: "Engineering Mechanics",
    importanceLevel: 0.06,
    topics: [
      "Free-body diagrams and equilibrium",
      "Trusses and frames",
      "Virtual work",
      "Kinematics and dynamics of particles and rigid bodies",
      "Impulse and momentum"
    ]
  },
  {
    subjectId: 3,
    subjectName: "Strength of Materials",
    importanceLevel: 0.09,
    topics: [
      "Stress and strain",
      "Elastic constants",
      "Poisson's ratio",
      "Mohr's circle",
      "Shear force and bending moment diagrams",
      "Bending and shear stresses",
      "Torsion",
      "Columns",
      "Thin cylinders"
    ]
  },
  {
    subjectId: 4,
    subjectName: "Theory of Machines",
    importanceLevel: 0.09,
    topics: [
      "Displacement, velocity and acceleration analysis of plane mechanisms",
      "Dynamic analysis of linkages",
      "Cams",
      "Gears and gear trains",
      "Flywheels and governors",
      "Balancing of reciprocating and rotating masses",
      "Vibrations"
    ]
  },
  {
    subjectId: 5,
    subjectName: "Machine Design",
    importanceLevel: 0.06,
    topics: [
      "Design for static and dynamic loading",
      "Failure theories",
      "Fatigue strength and S-N diagram",
      "Principles of design of bolted, riveted and welded joints",
      "Shafts",
      "Gears",
      "Rolling and sliding contact bearings",
      "Brakes and clutches",
      "Springs"
    ]
  },
  {
    subjectId: 6,
    subjectName: "Fluid Mechanics",
    importanceLevel: 0.09,
    topics: [
      "Fluid properties",
      "Fluid statics",
      "Manometry",
      "Buoyancy",
      "Forces on submerged bodies",
      "Stability of floating bodies",
      "Control-volume analysis",
      "Differential equations of continuity and momentum",
      "Bernoulli's equation",
      "Dimensional analysis",
      "Viscous flow of incompressible fluids",
      "Boundary layer",
      "Elementary turbulent flow",
      "Flow through pipes"
    ]
  },
  {
    subjectId: 7,
    subjectName: "Heat Transfer",
    importanceLevel: 0.06,
    topics: [
      "Modes of heat transfer",
      "One dimensional heat conduction",
      "Resistance concept and electrical analogy",
      "Heat transfer through fins",
      "Unsteady heat conduction",
      "Lumped parameter system",
      "Thermal boundary layer",
      "Dimensionless parameters in free and forced convective heat transfer",
      "Heat exchanger networks",
      "Radiation heat transfer"
    ]
  },
  {
    subjectId: 8,
    subjectName: "Thermodynamics",
    importanceLevel: 0.11,
    topics: [
      "Thermodynamic systems and processes",
      "Properties of pure substances",
      "Behavior of ideal and real gases",
      "First and second laws of thermodynamics",
      "Entropy",
      "Availability and irreversibility",
      "Thermodynamic relations"
    ]
  },
  {
    subjectId: 9,
    subjectName: "Power Plant Engineering",
    importanceLevel: 0.05,
    topics: [
      "Rankine cycle",
      "Reheat and regenerative cycles",
      "Boilers",
      "Steam turbines",
      "Gas turbines",
      "Combined cycles"
    ]
  },
  {
    subjectId: 10,
    subjectName: "Refrigeration & Air Conditioning",
    importanceLevel: 0.05,
    topics: [
      "Vapour compression refrigeration cycle",
      "Refrigerants",
      "Absorption refrigeration systems",
      "Psychrometric chart and psychrometric processes",
      "Air conditioning calculations"
    ]
  },
  {
    subjectId: 11,
    subjectName: "Internal Combustion Engines",
    importanceLevel: 0.05,
    topics: [
      "Air standard cycles (Otto, Diesel, Dual)",
      "Fuel injection and carburetion",
      "Combustion in SI and CI engines",
      "Performance parameters and testing"
    ]
  },
  {
    subjectId: 12,
    subjectName: "Manufacturing Engineering",
    importanceLevel: 0.14,
    topics: [
      "Engineering Materials",
      "Casting",
      "Forming",
      "Joining",
      "Machining and Machine Tool Operations",
      "Metrology and Inspection",
      "Computer Integrated Manufacturing"
    ]
  },
  {
    subjectId: 13,
    subjectName: "Industrial Engineering",
    importanceLevel: 0.06,
    topics: [
      "Production Planning and Control",
      "Inventory Control",
      "Operations Research (Linear programming, transportation, assignment, network models, PERT/CPM)"
    ]
  },
  {
    subjectId: 14,
    subjectName: "General Aptitude",
    importanceLevel: 0.15,
    topics: [
      "Verbal Ability",
      "Numerical Ability"
    ]
  }
];

async function main() {
  console.log('Seeding subjects reference data...');

  // Upsert subjects to ensure re-runs don't fail
  for (const subject of subjectsData) {
    await prisma.subject.upsert({
      where: { subjectId: subject.subjectId },
      update: {
        subjectName: subject.subjectName,
        importanceLevel: subject.importanceLevel,
        topics: subject.topics,
      },
      create: {
        subjectId: subject.subjectId,
        subjectName: subject.subjectName,
        importanceLevel: subject.importanceLevel,
        topics: subject.topics,
      },
    });
  }

  // Check if default Settings row exists
  await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      name: "GATE Aspirant",
      dailyAvailableHours: 4.0,
      scoreWeights: {
        study: 60,
        exercise: 15,
        reading: 10,
        routine: 15
      }
    }
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
