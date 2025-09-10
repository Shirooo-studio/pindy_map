class AddColumToUser < ActiveRecord::Migration[7.2]
  def change
    add_column :users, :full_name, :string
    add_column :users, :username, :string
    add_column :users, :phone_number, :string
  end
end
