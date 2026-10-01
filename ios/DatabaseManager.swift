import Foundation
import GRDB

class DatabaseManager {
    static let shared = DatabaseManager()
    var dbQueue: DatabaseQueue?

    private init() {}

    func initialize() {
        do {
            let fileManager = FileManager.default
            let folderURL = try fileManager.url(
                for: .documentDirectory, in: .userDomainMask,
                appropriateFor: nil, create: true)
                .appendingPathComponent("Database", isDirectory: true)

            try fileManager.createDirectory(at: folderURL, withIntermediateDirectories: true)

            let dbURL = folderURL.appendingPathComponent("db.sqlite")
            dbQueue = try DatabaseQueue(path: dbURL.path)
        } catch {
            print("Failed to create database: \(error)")
        }
    }

    func executeQuery(_ query: String) -> (Bool, [NSDictionary], Int64?, String?) {
        var results = [NSDictionary]()
        var isSuccessful = true
        var lastInsertRowID: Int64? = nil
        var errorMessage: String? = nil
        
        do {
            try dbQueue?.write { db in
                if query.lowercased().starts(with: "select") {
                    let rows = try Row.fetchAll(db, sql: query)
                    for row in rows {
                        let result = NSMutableDictionary()
                        for (column, dbValue) in row {
                            switch dbValue.storage {
                            case .null:
                                result[column] = NSNull()
                            case .int64(let int64):
                                result[column] = int64
                            case .double(let double):
                                result[column] = double
                            case .string(let string):
                                result[column] = string
                            case .blob(let data):
                                result[column] = data
                            }
                        }
                        results.append(result)
                    }
                } else {
                    print("Executing query: \(query)")
                    try db.execute(sql: query)
                    if query.lowercased().starts(with: "insert") {
                        lastInsertRowID = db.lastInsertedRowID
                    }
                }
            }
        } catch {
            print("Failed to execute query: \(error)")
            isSuccessful = false
            errorMessage = error.localizedDescription
        }
        return (isSuccessful, results, lastInsertRowID, errorMessage)
    }
}
