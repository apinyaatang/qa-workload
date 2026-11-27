export interface Epic {
  id:              string        // uuid PK
  epicNo:          number        // System.Id (unique from Azure DevOps)
  itemType:        string        // type of epic
  iteration:       string        // System.IterationPath
  project:         string        // System.AreaPath
  feature:         string        // System.Title
  state:           string        // System.State
  pmName:          string        // Custom.PMName
  baName:          string        // System.AssignedTo ของ Epic (= BA)
  sitDate:         string | null // Custom.SITDate
  uatDate:         string | null // Custom.UATDate
  targetDate:      string | null // Microsoft.VSTS.Scheduling.TargetDate
  testDate:        string | null // calculated: uatDate - testEstimateDay
  testingPercent:  number | null
  testerFlag:      string[]
  testerNote:      string
  testEstimateDay: number | null
  testLead:        string        // manual
  testOwner:       string        // from employees
  buddy1:          string        // co-tester 1
  buddy2:          string        // co-tester 2
  buddy3:          string        // co-tester 3
  itemsTotal:        number | null  // synced from ADO
  devCount:          number | null
  baCount:           number | null
  qaCount:           number | null
  waitConfirmCount:  number | null
  waitDeployCount:   number | null
  archivedCount:          number | null  // User Story/Bug ที่ State = Archieved
  itemsTotalWithArchived: number | null  // ทุก State รวม Archieved ไม่รวม Retired
  archivedPercent:        number | null  // archived_count / items_total_with_archived (คำนวณตอนอ่าน)
  itemsSyncedAt:     string | null
  devPercent:        number | null  // dev_count / items_total
  baPercent:         number | null  // ba_count / items_total
  donePercent:       number | null  // wait_deploy_count / items_total
  createdAt:       string
  updatedAt:       string
}

export interface AzureDevOpsConfig {
  orgUrl:      string  // https://dev.azure.com/org
  project:     string
  pat:         string
}

export const ADO_CONFIG_KEY = 'ado_config'
