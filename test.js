import XLSX from 'xlsx';
import pkg from 'lodash';
import { join } from 'path';

const { readFile, utils } = XLSX;
const { uniqWith, isEqual } = pkg;

function formatData(data) {
  const statistic = {
    num_submissions: 0,
    num_persons: 0,
    num_nets_given: 0,
  };

  const uniqueKeys = {
    village_keys: new Set(),
    health_area_keys: new Set(),
    health_zone_keys: new Set(),
    province_keys: new Set(),
    device_ids: new Set(),
  };

  let totalHouseholdSize = 0;

  const zsMap = new Map();
  const asMap = new Map();
  const villageMap = new Map();

  data.forEach((item) => {
    // Unique counts
    if (item.village_key) uniqueKeys.village_keys.add(item.village_key);
    if (item.health_area_key) uniqueKeys.health_area_keys.add(item.health_area_key);
    if (item.province_key) uniqueKeys.province_keys.add(item.province_key);
    if (item.device_id) uniqueKeys.device_ids.add(item.device_id);

    // Sum and count
    // const totalPersons = parseInt(item.nbr_total_pers_n || '0', 10);
    const netsGiven = parseInt(item.nbre_milds_donnees || '0', 10);
    // const sleepingSpaces = parseInt(item.nbr_couchettes_n || '0', 10);

    // statistic.num_persons += totalPersons;
    statistic.num_nets_given += netsGiven;
    // statistic.num_sleeping_spaces += sleepingSpaces;

    // if (item.type_menage_n === 'traditionnel') {
    //   statistic.num_traditional_households++;
    //   totalHouseholdSize += totalPersons;
    //   statistic.max_traditional_household_size = Math.max(
    //     statistic.max_traditional_household_size,
    //     totalPersons,
    //   );
    //   statistic.min_traditional_household_size = Math.min(
    //     statistic.min_traditional_household_size,
    //     totalPersons,
    //   );
    // } else {
    //   statistic.num_nontraditional_households++;
    // }

    // Last submission date
    // const createdAtLast = new Date(item.created_at);
    // if (createdAtLast > statistic.last_submissions) {
    //   statistic.last_submissions = createdAtLast;
    // }

    // // Submission count
    // if (item.uuid) {
    //   statistic.num_submissions++;
    // }

    //
    // const key = item.instanceID;
    // const health_zone = item.health_zone_key;
    const health_area = item.health_area_key;
    // const village = item.village_key;

    // // Access the barcodes scanned for this submission
    // const barcodeItems = barcodeMap.get(key) || [];
    // const mildScannedCount = barcodeItems.length;
    // const femmeEnceinte = (item.nbr_femmes_enceintes_n !== null && item.nbr_femmes_enceintes_n !== 'null' && item.nbr_femmes_enceintes_n !== '') ? parseInt(item.nbr_femmes_enceintes_n || '0', 10) : 0;
    
    // Calculate children under 5 statistics
    // const totalChildrenUnder5 = parseInt(item.nbr_enfts_0_5ans_n || '0', 10);
    // const totalMale = parseInt(item.nbr_pers_sexe_masculin || '0', 10);
    // const totalFemale = parseInt(item.nbr_pers_sexe_feminin || '0', 10);
    // const menuChildrenCount = parseInt(item.menu_enfants_5_n_count || '0', 10);

    // Calculate respondent age and sex
    const respondentAge = (item.age_rep_n !== null && item.age_rep_n !== 'null' && item.age_rep_n !== '') ? parseInt(item.age_rep_n || '0', 10) : 0;
    const respondentSex = item.sexe_rep_n || '';

    // Health Area update
    if (!asMap.has(health_area)) {
      asMap.set(health_area, {
        health_area,
        male_respondents: [],
        female_respondents: []
      });
    }
    const asData = asMap.get(health_area);

    // Add respondent to appropriate sex array
    if (respondentSex === 'masculin') {
      asData.male_respondents.push(respondentAge);
    } else if (respondentSex === 'feminin') {
      asData.female_respondents.push(respondentAge);
    }
  });

  // Calculate statistics and sort results alphabetically
  const results = Array.from(asMap.values()).map(item => {
    // Calculate male statistics
    const maleStats = item.male_respondents.length > 0 ? {
      male_min_age: Math.min(...item.male_respondents),
      male_max_age: Math.max(...item.male_respondents),
      male_count: item.male_respondents.length
    } : {
      male_min_age: 0,
      male_max_age: 0,
      male_count: 0
    };

    // Calculate female statistics
    const femaleStats = item.female_respondents.length > 0 ? {
      female_min_age: Math.min(...item.female_respondents),
      female_max_age: Math.max(...item.female_respondents),
      female_count: item.female_respondents.length
    } : {
      female_min_age: 0,
      female_max_age: 0,
      female_count: 0
    };

    return {
      health_area: item.health_area,
      ...maleStats,
      ...femaleStats,
      total_respondents: item.male_respondents.length + item.female_respondents.length
    };
  }).sort((a, b) => a.health_area.localeCompare(b.health_area));

  return results;
}

async function readXlsxFile() {
  const link = join('base.xlsx');
  const wb = XLSX.readFile(link);
  const ws = wb.SheetNames.find(name => name === "BS");
  const wshs = wb.Sheets[ws];
  const data = utils.sheet_to_json(wshs);
  const result = formatData(data);
  console.table(result);
  
  // Calculate totals
  const totals = {
    total_respondents: result.reduce((acc, item) => acc + item.total_respondents, 0),
    total_male_respondents: result.reduce((acc, item) => acc + item.male_count, 0),
    total_female_respondents: result.reduce((acc, item) => acc + item.female_count, 0),
    overall_male_min_age: Math.min(...result.map(item => item.male_min_age).filter(age => age > 0)),
    overall_male_max_age: Math.max(...result.map(item => item.male_max_age)),
    overall_female_min_age: Math.min(...result.map(item => item.female_min_age).filter(age => age > 0)),
    overall_female_max_age: Math.max(...result.map(item => item.female_max_age))
  };
  
  console.log('\nTotals:');
  console.table(totals);
}

readXlsxFile();