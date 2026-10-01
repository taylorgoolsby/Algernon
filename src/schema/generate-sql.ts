// generate-sql.js
import sqlDirective from 'graphql-to-sql'
import gql from 'graphql-tag'
import fs from 'fs'
import * as Message from './Message/MessageSchema'
import * as Completion from './Completion/CompletionSchema'
import * as ShortTermMemory from './ShortTermMemory/ShortTermMemorySchema'

const {
  sqlDirectiveTypeDefs,
  generateSql
} = sqlDirective('sql')

const typeDefs = gql`
  scalar JSON
  
  directive @sql (
    unicode: Boolean
    auto: Boolean
    default: String
    index: Boolean
    nullable: Boolean
    primary: Boolean
    type: String
    unique: Boolean
    generated: String
    constraints: String
  ) on OBJECT | FIELD_DEFINITION

  # See graphql-directive-private
  directive @private on OBJECT | FIELD_DEFINITION

  ${Message.typeDefs}
  ${Completion.typeDefs}
  ${ShortTermMemory.typeDefs}
`

const sql = generateSql({typeDefs: [typeDefs, sqlDirectiveTypeDefs]}, {
  databaseName: null,
  tablePrefix: null,
  dbType: 'sqlite'
})
console.log('sql', sql)

const sqlModule = `export default \`${sql.replaceAll('`', '\\`')}\``

fs.writeFileSync('src/schema/createTables.js', sqlModule, 'utf8')
