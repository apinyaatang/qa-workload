export interface Epic {
  id:              string        // uuid PK
  epicNo:          number        // System.Id (unique from Azure DevOps)
  itemType:        string        // type of epic
  iteration:       string        // System.IterationPath
  project:         string        // System.AreaPath
  feature:         string        // System.Title
  state:           string        // System.State
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
  createdAt:       string
  updatedAt:       string
}

export interface AzureDevOpsConfig {
  orgUrl:      string  // https://dev.azure.com/org
  project:     string
  pat:         string
}

export const ADO_CONFIG_KEY = 'ado_config'
