class AddProfileFieldsToUsers < ActiveRecord::Migration[7.2]
  def change
    # 既存の可能性があるものは条件付きで
    add_column :users, :full_name, :string unless column_exists?(:users, :full_name)
    add_column :users, :username,  :string unless column_exists?(:users, :username)

    # 新規に欲しいフィールド
    add_column :users, :company,        :string unless column_exists?(:users, :company)
    add_column :users, :work_location,  :string unless column_exists?(:users, :work_location)
    add_column :users, :department,     :string unless column_exists?(:users, :department)

    # プロフィール完了フラグ（デフォルト false）
    unless column_exists?(:users, :profile_completed)
      add_column :users, :profile_completed, :boolean, default: false, null: false
    end

    # username のユニークインデックス（未作成なら）
    add_index :users, :username, unique: true unless index_exists?(:users, :username, unique: true)
  end
end
