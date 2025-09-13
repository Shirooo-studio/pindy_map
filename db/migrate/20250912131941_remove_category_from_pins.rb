class RemoveCategoryFromPins < ActiveRecord::Migration[7.2]
  def change
    remove_column :pins, :category, :integer
  end
end
