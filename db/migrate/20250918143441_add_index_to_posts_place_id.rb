class AddIndexToPostsPlaceId < ActiveRecord::Migration[7.2]
  def change
    add_index :posts, :place_id unless index_exists?(:posts, :place_id)
  end
end
